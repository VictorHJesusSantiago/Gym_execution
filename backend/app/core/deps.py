import hmac
from datetime import datetime, timezone

import redis as redis_lib
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..models.user import User
from .config import settings
from .database import get_db
from .redis import get_redis
from .security import decode_access_token

bearer_scheme = HTTPBearer()

bearer_scheme_optional = HTTPBearer(auto_error=False)
"""Para rotas que ACEITAM um token mas não o exigem — hoje só /auth/logout, que
precisa funcionar mesmo com o access token já expirado."""

_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Token inválido ou expirado",
    headers={"WWW-Authenticate": "Bearer"},
)
"""Resposta única para token inválido, revogado ou de usuário inexistente —
distinguir os casos confirmaria a um atacante quais contas existem."""


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
    redis: redis_lib.Redis = Depends(get_redis),
) -> User:
    claims = decode_access_token(credentials.credentials)
    if claims is None:
        raise _INVALID_CREDENTIALS

    if is_access_token_revoked(claims.token_id, redis):
        raise _INVALID_CREDENTIALS

    user = db.get(User, claims.subject)
    if user is None:
        raise _INVALID_CREDENTIALS

    return user


_REVOKED_PREFIX = "access:revoked:"


def is_access_token_revoked(token_id: str, redis: redis_lib.Redis) -> bool:
    return redis.get(f"{_REVOKED_PREFIX}{token_id}") is not None


def revoke_access_token(token_id: str, expires_at: datetime, redis: redis_lib.Redis) -> None:
    """Coloca o `jti` numa denylist até o token expirar naturalmente.

    O TTL é o tempo QUE FALTA para o token expirar, não um valor fixo: manter a
    entrada além disso só ocuparia memória do Redis para bloquear um token que
    já seria rejeitado pela validação de `exp`.

    Custo assumido: uma leitura no Redis por request autenticado. É o preço de
    ter JWT revogável — sem a denylist, "sair da conta" não encerrava a sessão
    de verdade, só apagava as credenciais do aparelho, e um token copiado antes
    do logout continuava aceito até 30 minutos depois.
    """
    remaining = int((expires_at - datetime.now(timezone.utc)).total_seconds())
    if remaining <= 0:
        return
    redis.set(f"{_REVOKED_PREFIX}{token_id}", "1", ex=remaining)


def require_admin_api_key(x_admin_api_key: str | None = Header(default=None)) -> None:
    """Protege endpoints administrativos chamados por processos internos.
    Comparação em tempo constante para evitar timing attacks na chave.

    Header ausente devolve 401 (não autenticado), não 422: com `Header(...)`
    obrigatório o FastAPI tratava a falta da credencial como erro de validação
    de schema, devolvendo um corpo que descreve o header esperado — um erro de
    autenticação disfarçado de erro de forma, que ainda revelava o nome exato do
    header a quem só sondava a rota."""
    if x_admin_api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credencial administrativa ausente",
        )
    if not hmac.compare_digest(x_admin_api_key, settings.admin_api_key):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chave administrativa inválida")
