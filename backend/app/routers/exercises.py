from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.exercise import Exercise
from ..schemas.exercise import ExercisePublic

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExercisePublic])
def list_exercises(db: Session = Depends(get_db)) -> list[Exercise]:
    """Catálogo de exercícios com link para o modelo de referência (pose),
    cacheável localmente pelo app — ver ARCHITECTURE.md seção 3."""
    return list(db.scalars(select(Exercise)))


@router.get("/{exercise_id}", response_model=ExercisePublic)
def get_exercise(exercise_id: str, db: Session = Depends(get_db)) -> Exercise | None:
    return db.get(Exercise, exercise_id)
