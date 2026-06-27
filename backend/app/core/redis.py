import redis as redis_lib

from .config import settings

_pool: redis_lib.ConnectionPool | None = None


def _get_pool() -> redis_lib.ConnectionPool:
    global _pool
    if _pool is None:
        _pool = redis_lib.ConnectionPool.from_url(settings.redis_url, decode_responses=True)
    return _pool


def get_redis() -> redis_lib.Redis:
    """Dependência FastAPI: retorna um cliente Redis do pool compartilhado.
    Sobrescrita nos testes por um FakeRedis em memória (ver tests/conftest.py)."""
    return redis_lib.Redis(connection_pool=_get_pool())
