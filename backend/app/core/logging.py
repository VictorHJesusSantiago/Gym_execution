import logging
import time

from fastapi import Request

logger = logging.getLogger("app.request")


def configure_logging() -> None:
    """Configura o logging raiz da aplicação (chamado uma vez em main.py).

    Em produção, o orquestrador (Docker/k8s) coleta stdout — não há
    necessidade de handlers de arquivo aqui.
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


async def log_requests_middleware(request: Request, call_next):
    """Loga método, caminho, status e duração de cada requisição —
    observabilidade mínima para depurar latência/erros em produção sem
    precisar de um APM externo."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s -> %d (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response
