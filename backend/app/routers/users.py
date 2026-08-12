import redis as redis_lib
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.redis import get_redis
from ..models.user import User
from ..schemas.auth import UserPublic, UserUpdate
from ..services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def get_my_profile(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserPublic)
def update_my_profile(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """PATCH: atualiza apenas os campos enviados — campos omitidos não são
    alterados. Migrado de PUT para refletir a semântica correta de atualização
    parcial (RFC 5789)."""
    return user_service.update_user_profile(db, current_user, payload)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    db: Session = Depends(get_db),
    redis: redis_lib.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
) -> None:
    """Exclui a conta e todo o histórico de treinos (LGPD art. 18 / GDPR art. 17).

    Irreversível e imediato. Não há período de carência nem lixeira: os dados
    aqui são pessoais e de saúde, e a lei fala em eliminação, não em ocultação.
    Todas as sessões ativas (todos os aparelhos) são revogadas em seguida.
    """
    user_service.delete_user_account(db, current_user, redis)
