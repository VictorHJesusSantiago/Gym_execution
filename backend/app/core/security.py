import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AccessTokenClaims:
    """Claims que a aplicação usa de um access token já validado."""

    subject: str
    """`sub` — o id do usuário."""
    token_id: str
    """`jti` — identificador único deste token, usado para revogá-lo no logout."""
    expires_at: datetime
    """`exp` — necessário para dar à entrada na denylist um TTL igual ao que
    resta do token, em vez de mantê-la para sempre."""


def hash_password(password: str) -> str:
    """bcrypt nativo: compatível com hashes existentes gerados pelo passlib/bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(subject: str) -> str:
    """Access token de curta duração.

    O `jti` existe para tornar o token REVOGÁVEL: sem ele, o logout só
    invalidava o refresh token e o access token seguia valendo até expirar
    sozinho (até 30 min depois de o usuário achar que encerrou a sessão) — sem
    identificador, não havia sequer como nomear qual token bloquear.
    """
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": str(subject),
        "exp": expires_at,
        "iat": issued_at,
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> AccessTokenClaims | None:
    """Valida assinatura/expiração e devolve as claims, ou `None` se inválido.

    `algorithms` é uma lista fechada com o algoritmo configurado — é o que
    impede o ataque `alg: none` e a confusão HS/RS, em que um atacante escolhe
    como o servidor verifica a própria assinatura.

    `require` torna explícito que um token sem `exp`/`sub`/`jti` é inválido: por
    padrão o PyJWT aceita a AUSÊNCIA de uma claim (só valida as que existem),
    então um token sem `exp` seria eterno.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "jti"]},
        )
    except jwt.InvalidTokenError:
        logger.warning("Falha ao decodificar token de acesso")
        return None

    return AccessTokenClaims(
        subject=payload["sub"],
        token_id=payload["jti"],
        expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
    )
