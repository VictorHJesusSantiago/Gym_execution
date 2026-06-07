from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.training_session import TrainingSession
from ..models.user import User
from ..schemas.session import TrainingSessionCreate, TrainingSessionPublic

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=TrainingSessionPublic, status_code=status.HTTP_201_CREATED)
def record_session(
    payload: TrainingSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TrainingSession:
    """Recebe apenas o resultado (score) calculado no dispositivo —
    nunca o vídeo bruto, conforme decisão de privacidade/performance
    em ARCHITECTURE.md seção 5."""
    session = TrainingSession(
        user_id=current_user.id,
        exercise_id=payload.exercise_id,
        score=payload.score,
        executed_at=payload.executed_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[TrainingSessionPublic])
def list_my_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TrainingSession]:
    stmt = (
        select(TrainingSession)
        .where(TrainingSession.user_id == current_user.id)
        .order_by(TrainingSession.executed_at.desc())
    )
    return list(db.scalars(stmt))
