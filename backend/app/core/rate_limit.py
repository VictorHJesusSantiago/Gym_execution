from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import settings

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.rate_limit_enabled,
    storage_uri=settings.rate_limit_storage_uri,
)

AUTH_RATE_LIMIT = "10/minute"
"""Aplicado a TODOS os endpoints públicos de /auth — inclusive /refresh e
/logout, que não exigem autenticação prévia e portanto são tão automatizáveis
quanto /login (um refresh token roubado podia ser testado sem limite algum)."""
