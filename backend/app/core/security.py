import logging
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import settings

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """bcrypt nativo: compatível com hashes existentes gerados pelo passlib/bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(subject: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(subject), "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except jwt.InvalidTokenError:
        # Token malformado/expirado/assinatura inválida — não logar o token
        # em si (PII/credencial), só o evento, para detectar abuso.
        logger.warning("Falha ao decodificar token de acesso")
        return None
