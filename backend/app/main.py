import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from .core.config import settings
from .core.database import SessionLocal
from .core.logging import configure_logging, log_requests_middleware
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
    allow_headers=["Authorization", "Content-Type"],
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
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Erro interno do servidor"},
    )


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(exercises.router)
app.include_router(sessions.router)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Probe real do banco (A5): orquestradores como ECS/k8s usam este endpoint
    para decidir se o container está pronto — retornar 200 sem checar o DB
    escondia falhas de conectividade."""
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        return JSONResponse(  # type: ignore[return-value]
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unavailable"},
        )
    finally:
        db.close()
