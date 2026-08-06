import logging

from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from .core.config import settings
from .core.database import SessionLocal
from .core.deps import require_admin_api_key
from .core.logging import (
    REQUEST_ID_HEADER,
    configure_logging,
    get_request_id,
    log_requests_middleware,
    render_metrics,
)
from .core.rate_limit import limiter
from .routers import auth, exercises, sessions, users

configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name)

app.middleware("http")(log_requests_middleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", REQUEST_ID_HEADER],
    # Sem isto o navegador esconde o header do JS do app, e o id de correlação
    # não chega a quem precisaria citá-lo num relato de erro.
    expose_headers=[REQUEST_ID_HEADER],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Captura exceções não tratadas — garante que stack traces não vazem
    para o cliente e que todo erro seja logado estruturadamente com contexto."""
    logger.error(
        "unhandled_exception",
        exc_info=exc,
        extra={"path": request.url.path, "method": request.method},
    )
    # O id vai no corpo além do header: é o que o usuário consegue copiar de uma
    # tela de erro e citar no suporte, ligando o relato à linha exata do log.
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Erro interno do servidor", "requestId": get_request_id()},
    )


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(exercises.router)
app.include_router(sessions.router)


@app.get("/health/live", tags=["health"])
def liveness_probe() -> dict[str, str]:
    """Liveness: o processo responde? Não toca em dependência externa.

    Separado da readiness de propósito. Com um probe único que consultava o
    banco, uma indisponibilidade momentânea do Postgres fazia o orquestrador
    concluir que o CONTÊINER estava morto e reiniciá-lo — um banco lento
    derrubava em loop réplicas que estavam perfeitamente sadias, transformando
    uma degradação parcial em queda total.
    """
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def readiness_probe() -> JSONResponse:
    """Readiness: dá para receber tráfego? Checa o banco de verdade.

    Sem dependência sadia a réplica sai do balanceador (503) mas continua viva,
    e volta sozinha quando o banco responder.
    """
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return JSONResponse(status_code=status.HTTP_200_OK, content={"status": "ok"})
    except Exception:
        logger.warning("readiness_probe_failed", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unavailable"},
        )
    finally:
        db.close()


@app.get(
    "/metrics",
    tags=["health"],
    dependencies=[Depends(require_admin_api_key)],
    response_class=PlainTextResponse,
)
def metrics() -> PlainTextResponse:
    """Métricas RED (Rate/Errors/Duration) no formato do Prometheus.

    Protegido pela chave administrativa: os rótulos revelam quais rotas existem
    e com que volume são usadas — inventário útil demais para deixar aberto.
    Se o scraper viver dentro da rede privada, dá para trocar por restrição de
    origem no gateway.
    """
    return PlainTextResponse(content=render_metrics(), media_type="text/plain; version=0.0.4")


@app.get("/health", tags=["health"], deprecated=True)
def health_check() -> JSONResponse:
    """Mantido como alias de readiness para não quebrar healthchecks já
    apontados para cá (Dockerfile antigo, monitores externos). Prefira
    /health/live e /health/ready em configuração nova."""
    return readiness_probe()
