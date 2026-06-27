from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import settings

# Quando rate_limit_enabled=False (testes, via conftest.py), usa memória local
# para não exigir Redis rodando. Em produção (enabled=True), usa Redis para
# compartilhar o estado entre workers/réplicas — sem isso o limite é por
# processo e facilmente contornado distribuindo requests entre instâncias.
_storage_uri = settings.redis_url if settings.rate_limit_enabled else "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.rate_limit_enabled,
    storage_uri=_storage_uri,
)

AUTH_RATE_LIMIT = "10/minute"
