from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
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
