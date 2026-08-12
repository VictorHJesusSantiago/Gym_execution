import hashlib
import logging
import secrets

from fastapi import HTTPException, status
from redis import Redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.security import create_access_token, hash_password, verify_password
from ..models.user import User
from ..schemas.auth import UserCreate

logger = logging.getLogger(__name__)

_REFRESH_PREFIX = "refresh:"
_CONSUMED_PREFIX = "refresh:consumed:"
_USER_TOKENS_PREFIX = "refresh:user:"

_INVALID_REFRESH_TOKEN = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Refresh token inválido ou expirado",
)
"""Mensagem única para token ausente/expirado/consumido/de usuário removido:
distinguir os casos diria a um atacante se o token *já existiu*, e se a conta
por trás dele existe."""


def _fingerprint(refresh_token: str) -> str:
    """SHA-256 do token — o Redis guarda só o digest, nunca a credencial.

    Antes a chave era `refresh:<token em texto puro>`: um dump/backup do Redis,
    ou um `KEYS refresh:*` numa instância compartilhada, entregava credenciais
    de 30 dias funcionais de todos os usuários. Com o digest, o vazamento do
    armazenamento não é mais suficiente para se passar por ninguém.

    SHA-256 puro (sem KDF/salt) é adequado AQUI, diferente de senha: o token tem
    ~384 bits de entropia vindos de `secrets.token_urlsafe(48)`, então não há
    espaço de busca para força bruta ou rainbow table.
    """
    return hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()


def register_user(db: Session, payload: UserCreate) -> User:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail já cadastrado")
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )
    return user


def issue_tokens(user: User, redis: Redis) -> tuple[str, str]:
    """Gera access token (curto prazo) e refresh token (longo prazo).

    Só o digest do refresh token vai para o Redis (ver `_fingerprint`), junto de
    um índice por usuário que torna possível revogar TODAS as sessões de uma vez
    quando se detecta reuso (ver `refresh_access_token`).
    """
    access_token = create_access_token(subject=user.id)
    refresh_token = secrets.token_urlsafe(48)
    fingerprint = _fingerprint(refresh_token)
    ttl_seconds = settings.refresh_token_expire_days * 86_400

    redis.set(f"{_REFRESH_PREFIX}{fingerprint}", str(user.id), ex=ttl_seconds)

    index_key = f"{_USER_TOKENS_PREFIX}{user.id}"
    redis.sadd(index_key, fingerprint)
    # O índice expira junto com o token mais recente; cada emissão o renova.
    redis.expire(index_key, ttl_seconds)

    return access_token, refresh_token


def refresh_access_token(refresh_token: str, redis: Redis, db: Session) -> tuple[str, str]:
    """Valida o refresh token, invalida-o (rotação) e emite um novo par."""
    fingerprint = _fingerprint(refresh_token)
    ttl_seconds = settings.refresh_token_expire_days * 86_400

    consumed_by = redis.get(f"{_CONSUMED_PREFIX}{fingerprint}")
    if consumed_by is not None:
        # Replay de um token JÁ rotacionado. Ou o cliente perdeu a resposta da
        # rotação anterior, ou o token vazou e está sendo usado em paralelo —
        # e não há como distinguir. O OAuth 2.0 Security BCP manda tratar como
        # comprometimento: derruba a família inteira e força login novo.
        # Sem isto, um token roubado rendia acesso indefinido, porque a rotação
        # sozinha só invalida o token usado, nunca denuncia o ladrão.
        logger.warning("refresh_token_reuse_detected", extra={"user_id": consumed_by})
        revoke_all_sessions(consumed_by, redis)
        raise _INVALID_REFRESH_TOKEN

    user_id = redis.get(f"{_REFRESH_PREFIX}{fingerprint}")
    if user_id is None:
        raise _INVALID_REFRESH_TOKEN

    user = db.get(User, user_id)
    if user is None:
        # Conta removida entre a emissão e o refresh: limpa o que sobrou.
        revoke_all_sessions(user_id, redis)
        raise _INVALID_REFRESH_TOKEN

    _consume(fingerprint, user_id, redis, ttl_seconds)
    return issue_tokens(user, redis)


def revoke_refresh_token(refresh_token: str, redis: Redis) -> None:
    """Logout: descarta o token sem marcá-lo como "consumido".

    Marcar aqui faria um segundo logout com o mesmo token (retry de rede, dois
    dispositivos fechando juntos) disparar a revogação total — punindo o usuário
    por um comportamento normal. O reuso só interessa em `/auth/refresh`, onde
    significa alguém tentando *obter* credenciais novas.
    """
    fingerprint = _fingerprint(refresh_token)
    user_id = redis.get(f"{_REFRESH_PREFIX}{fingerprint}")

    redis.delete(f"{_REFRESH_PREFIX}{fingerprint}")
    if user_id is not None:
        redis.srem(f"{_USER_TOKENS_PREFIX}{user_id}", fingerprint)


def _consume(fingerprint: str, user_id: str, redis: Redis, ttl_seconds: int) -> None:
    """Invalida o token e registra que ele já foi usado (para detectar replay)."""
    redis.delete(f"{_REFRESH_PREFIX}{fingerprint}")
    redis.srem(f"{_USER_TOKENS_PREFIX}{user_id}", fingerprint)
    # A marca vive o mesmo tempo que o token viveria: depois disso ele já
    # estaria expirado de qualquer forma e o replay cai no 401 comum.
    redis.set(f"{_CONSUMED_PREFIX}{fingerprint}", user_id, ex=ttl_seconds)


def revoke_all_sessions(user_id: str, redis: Redis) -> None:
    """Derruba todos os refresh tokens ativos do usuário (todos os aparelhos)."""
    index_key = f"{_USER_TOKENS_PREFIX}{user_id}"
    fingerprints = redis.smembers(index_key)
    if fingerprints:
        redis.delete(*(f"{_REFRESH_PREFIX}{fp}" for fp in fingerprints))
    redis.delete(index_key)
