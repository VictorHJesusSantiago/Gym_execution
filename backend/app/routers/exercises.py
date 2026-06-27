from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import require_admin_api_key
from ..models.exercise import Exercise
from ..schemas.exercise import ExercisePublic, ExerciseReferenceModelUpdate
from ..services import exercise_service

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExercisePublic])
def list_exercises(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[Exercise]:
    """Catálogo paginado (A7) — evita SELECT * ilimitado conforme o catálogo
    cresce. Cacheável por CDN com Cache-Control no gateway."""
    return exercise_service.list_exercises(db, limit=limit, offset=offset)


@router.get("/{exercise_id}", response_model=ExercisePublic)
def get_exercise(exercise_id: str, db: Session = Depends(get_db)) -> Exercise:
    return exercise_service.get_exercise(db, exercise_id)


@router.put(
    "/{exercise_id}/reference-model",
    response_model=ExercisePublic,
    dependencies=[Depends(require_admin_api_key)],
)
def update_reference_model(
    exercise_id: str,
    payload: ExerciseReferenceModelUpdate,
    db: Session = Depends(get_db),
) -> Exercise:
    return exercise_service.update_exercise_reference_model(db, exercise_id, payload.reference_model_uri)
