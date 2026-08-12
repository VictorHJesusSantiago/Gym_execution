import redis as redis_lib
from fastapi import APIRouter, Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import bearer_scheme_optional, revoke_access_token
from ..core.rate_limit import AUTH_RATE_LIMIT, limiter
from ..core.redis import get_redis
from ..core.security import decode_access_token
from ..models.user import User
from ..schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
    TokenResponse,
    UserCreate,
    UserPublic,
)
from ..services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
@limiter.limit(AUTH_RATE_LIMIT)
def register(
    request: Request,
    payload: UserCreate,
    db: Session = Depends(get_db),
) -> User:
    return auth_service.register_user(db, payload)


@router.post("/login", response_model=TokenResponse)
@limiter.limit(AUTH_RATE_LIMIT)
def login(
    request: Request,
    payload: LoginRequest,
    db: Session = Depends(get_db),
    redis: redis_lib.Redis = Depends(get_redis),
) -> TokenResponse:
    user = auth_service.authenticate_user(db, payload.email, payload.password)
    access_token, refresh_token = auth_service.issue_tokens(user, redis)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=RefreshTokenResponse)
@limiter.limit(AUTH_RATE_LIMIT)
def refresh_token(
    request: Request,
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
    redis: redis_lib.Redis = Depends(get_redis),
) -> RefreshTokenResponse:
    """Troca o refresh token por um novo par (rotação): invalida o token
    recebido e emite um novo, limitando a janela de abuso em caso de vazamento.

    Rate-limited como /login: é público (sem Authorization) e devolve credenciais,
    então sem limite um atacante podia varrer tokens à vontade — e cada tentativa
    custa um GET no Redis mais um SELECT no banco."""
    new_access, new_refresh = auth_service.refresh_access_token(payload.refresh_token, redis, db)
    return RefreshTokenResponse(access_token=new_access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(AUTH_RATE_LIMIT)
def logout(
    request: Request,
    payload: RefreshTokenRequest,
    redis: redis_lib.Redis = Depends(get_redis),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme_optional),
) -> None:
    """Encerra a sessão: revoga o refresh token E o access token em uso.

    O access token só era descartado no aparelho — quem tivesse copiado o valor
    (log, proxy, backup) continuava autenticado por até `jwt_expire_minutes`
    depois do "Sair". Agora o `jti` entra numa denylist até expirar.

    O Authorization é OPCIONAL de propósito: o logout precisa funcionar mesmo
    com o access token já expirado, que é justamente quando o usuário mais
    precisa encerrar a sessão.
    """
    auth_service.revoke_refresh_token(payload.refresh_token, redis)

    if credentials is not None:
        claims = decode_access_token(credentials.credentials)
        if claims is not None:
            revoke_access_token(claims.token_id, claims.expires_at, redis)
