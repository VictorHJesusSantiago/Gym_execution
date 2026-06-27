from sqlalchemy.orm import Session

from ..models.user import User
from ..schemas.auth import UserUpdate


def update_user_profile(db: Session, user: User, payload: UserUpdate) -> User:
    """PATCH semântico: só atualiza campos explicitamente enviados pelo cliente.
    `model_dump(exclude_unset=True)` garante que campos omitidos não sejam
    sobrescritos com None — diferente do PUT que exigia todos os campos."""
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
