from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .core.config import settings
from .core.rate_limit import limiter
from .routers import auth, exercises, sessions, users

app = FastAPI(title=settings.app_name)

# Limita por IP os endpoints sensíveis a força bruta (/auth/register,
# /auth/login — ver app/core/rate_limit.py); o handler converte estouros
# em 429 com corpo JSON consistente com o resto da API.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(exercises.router)
app.include_router(sessions.router)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}
