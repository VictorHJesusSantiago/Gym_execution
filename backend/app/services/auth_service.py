import secrets

from fastapi import HTTPException, status
from redis import Redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.security import create_access_token, hash_password, verify_password
from ..models.user import User
from ..schemas.auth import UserCreate

_REFRESH_PREFIX = "refresh:"


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
    O refresh token é armazenado no Redis com TTL — rotacionado a cada uso."""
    access_token = create_access_token(subject=user.id)
    refresh_token = secrets.token_urlsafe(48)
    ttl_seconds = settings.refresh_token_expire_days * 86_400
    redis.set(f"{_REFRESH_PREFIX}{refresh_token}", str(user.id), ex=ttl_seconds)
    return access_token, refresh_token


def refresh_access_token(refresh_token: str, redis: Redis, db: Session) -> tuple[str, str]:
    """Valida o refresh token, invalida-o (rotação) e emite um novo par."""
    user_id = redis.get(f"{_REFRESH_PREFIX}{refresh_token}")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado",
        )
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado",
        )
    redis.delete(f"{_REFRESH_PREFIX}{refresh_token}")
    return issue_tokens(user, redis)


def revoke_refresh_token(refresh_token: str, redis: Redis) -> None:
    redis.delete(f"{_REFRESH_PREFIX}{refresh_token}")
