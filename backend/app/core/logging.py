import logging
import time
import uuid
from contextvars import ContextVar

from fastapi import Request
from pythonjsonlogger import jsonlogger

REQUEST_ID_HEADER = "X-Request-ID"

_request_id: ContextVar[str] = ContextVar("request_id", default="-")
"""ContextVar e não variável global: cada request roda numa task/thread própria
e uma global embaralharia os ids entre requests concorrentes."""


def get_request_id() -> str:
    return _request_id.get()


class _RequestIdFilter(logging.Filter):
    """Injeta o id do request em TODA linha de log.

    É isto que torna os logs correlacionáveis: antes, `log_requests_middleware`
    registrava uma linha por request e qualquer log emitido dentro dele (um
    `refresh_token_reuse_detected`, um `unhandled_exception`) saía solto, sem
    nada ligando os dois. Investigar um erro relatado por um usuário significava
    adivinhar qual linha pertencia a qual chamada.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


def configure_logging() -> None:
    """Logging JSON estruturado: cada linha é um objeto JSON independente,
    parseável por CloudWatch / Datadog / Loki sem regex."""
    handler = logging.StreamHandler()
    handler.setFormatter(
        jsonlogger.JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(request_id)s %(message)s",
            rename_fields={"asctime": "timestamp", "levelname": "level", "request_id": "requestId"},
        )
    )
    handler.addFilter(_RequestIdFilter())
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers = [handler]


async def log_requests_middleware(request: Request, call_next):
    """Correlaciona, cronometra e mede cada request.

    O id vem do header `X-Request-ID` quando o cliente manda um (permitindo
    seguir um rastro do app até a API) e é gerado aqui caso contrário. Volta
    sempre na resposta, para que um usuário possa relatar um erro citando um id
    que existe nos logs.
    """
    request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
    token = _request_id.set(request_id)

    start = time.perf_counter()
    try:
        response = await call_next(request)
    finally:
        _request_id.reset(token)

    duration_ms = (time.perf_counter() - start) * 1000

    # `request.scope["route"]` é o TEMPLATE da rota (/exercises/{exercise_id}),
    # não o caminho concreto: métricas por caminho concreto explodiriam a
    # cardinalidade (uma série temporal por id de exercício) e ainda colocariam
    # identificadores de usuário nos rótulos.
    route = request.scope.get("route")
    route_template = getattr(route, "path", None) or "unmatched"

    observe_request(request.method, route_template, response.status_code, duration_ms)

    logging.getLogger("app.request").info(
        "http_request",
        extra={
            "method": request.method,
            "path": request.url.path,
            "route": route_template,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 1),
        },
    )

    response.headers[REQUEST_ID_HEADER] = request_id
    return response


# --- Métricas (método RED: Rate, Errors, Duration) --------------------------
#
# Implementação própria, em memória, em vez de `prometheus-client`: a API é um
# processo só por réplica, o formato de exposição do Prometheus é texto simples
# e estável, e o projeto trata cada dependência nova como superfície de
# supply-chain (ver requirements.txt). São ~40 linhas contra mais um pacote.

_LATENCY_BUCKETS_MS = (5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000)

_request_totals: dict[tuple[str, str, int], int] = {}
_request_duration_sums: dict[tuple[str, str], float] = {}
_request_duration_counts: dict[tuple[str, str], int] = {}
_request_duration_buckets: dict[tuple[str, str, float], int] = {}


def observe_request(method: str, route: str, status_code: int, duration_ms: float) -> None:
    _request_totals[(method, route, status_code)] = _request_totals.get((method, route, status_code), 0) + 1

    key = (method, route)
    _request_duration_sums[key] = _request_duration_sums.get(key, 0.0) + duration_ms
    _request_duration_counts[key] = _request_duration_counts.get(key, 0) + 1
    for bucket in _LATENCY_BUCKETS_MS:
        if duration_ms <= bucket:
            _request_duration_buckets[(method, route, bucket)] = (
                _request_duration_buckets.get((method, route, bucket), 0) + 1
            )


def render_metrics() -> str:
    """Exposição no formato de texto do Prometheus (v0.0.4)."""
    lines = [
        "# HELP http_requests_total Total de requests HTTP.",
        "# TYPE http_requests_total counter",
    ]
    for (method, route, status_code), total in sorted(_request_totals.items()):
        lines.append(
            f'http_requests_total{{method="{method}",route="{route}",status="{status_code}"}} {total}'
        )

    lines += [
        "# HELP http_request_duration_ms Latência das requests HTTP em milissegundos.",
        "# TYPE http_request_duration_ms histogram",
    ]
    for (method, route), count in sorted(_request_duration_counts.items()):
        cumulative = 0
        for bucket in _LATENCY_BUCKETS_MS:
            cumulative = _request_duration_buckets.get((method, route, bucket), 0)
            lines.append(
                f'http_request_duration_ms_bucket{{method="{method}",route="{route}",le="{bucket}"}} {cumulative}'
            )
        lines.append(
            f'http_request_duration_ms_bucket{{method="{method}",route="{route}",le="+Inf"}} {count}'
        )
        lines.append(
            f'http_request_duration_ms_sum{{method="{method}",route="{route}"}} '
            f"{_request_duration_sums[(method, route)]:.1f}"
        )
        lines.append(f'http_request_duration_ms_count{{method="{method}",route="{route}"}} {count}')

    return "\n".join(lines) + "\n"


def reset_metrics() -> None:
    """Só para testes — o processo real nunca zera os contadores."""
    _request_totals.clear()
    _request_duration_sums.clear()
    _request_duration_counts.clear()
    _request_duration_buckets.clear()
