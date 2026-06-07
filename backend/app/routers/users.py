from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..schemas.auth import UserPublic, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def get_my_profile(current_user: User = Depends(get_current_user)) -> User:
    """Dados do usuário autenticado — consumido pela tela de Perfil
    (ver UX_PLAN.md)."""
    return current_user


@router.put("/me", response_model=UserPublic)
def update_my_profile(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    current_user.name = payload.name
    db.commit()
    db.refresh(current_user)
    return current_user
