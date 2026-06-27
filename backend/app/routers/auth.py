import redis as redis_lib
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.rate_limit import AUTH_RATE_LIMIT, limiter
from ..core.redis import get_redis
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
def refresh_token(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
    redis: redis_lib.Redis = Depends(get_redis),
) -> RefreshTokenResponse:
    """Troca o refresh token por um novo par (rotação): invalida o token
    recebido e emite um novo, limitando a janela de abuso em caso de vazamento."""
    new_access, new_refresh = auth_service.refresh_access_token(payload.refresh_token, redis, db)
    return RefreshTokenResponse(access_token=new_access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: RefreshTokenRequest,
    redis: redis_lib.Redis = Depends(get_redis),
) -> None:
    auth_service.revoke_refresh_token(payload.refresh_token, redis)
