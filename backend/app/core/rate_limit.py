from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import settings

# Limita por IP de origem — suficiente para mitigar força bruta/credential
# stuffing em /auth sem exigir autenticação prévia (que ainda não existe
# nesse ponto do fluxo). Limites por usuário autenticado podem ser
# adicionados depois com `key_func` baseada no token, se necessário.
limiter = Limiter(key_func=get_remote_address, enabled=settings.rate_limit_enabled)

AUTH_RATE_LIMIT = "10/minute"
"""Aplicado a /auth/register e /auth/login — generoso o bastante para uso
normal (poucas tentativas por minuto), mas barra varreduras automatizadas
de credenciais. Ver ARCHITECTURE.md seção de segurança."""
