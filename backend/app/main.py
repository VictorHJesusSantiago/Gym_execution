from fastapi import FastAPI

from .core.config import settings
from .routers import auth, exercises, sessions

app = FastAPI(title=settings.app_name)

app.include_router(auth.router)
app.include_router(exercises.router)
app.include_router(sessions.router)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}
