from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .core.config import settings
from .core.rate_limit import limiter
from .routers import auth, exercises, sessions, users

app = FastAPI(title=settings.app_name)

# Necessário para o build web do Expo (servido de uma origem diferente da
# API) conseguir chamar a API a partir do navegador — sem isso, o navegador
# bloqueia todas as respostas por CORS. Lista de origens vem de
# `settings.cors_allowed_origins` (ver app/core/config.py).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    # Não expor `environment` publicamente — informação de reconhecimento
    # desnecessária para um endpoint sem autenticação (usado por orquestradores).
    return {"status": "ok"}
