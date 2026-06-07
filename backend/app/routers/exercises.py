from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import require_admin_api_key
from ..models.exercise import Exercise
from ..schemas.exercise import ExercisePublic, ExerciseReferenceModelUpdate

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExercisePublic])
def list_exercises(db: Session = Depends(get_db)) -> list[Exercise]:
    """Catálogo de exercícios com link para o modelo de referência (pose),
    cacheável localmente pelo app — ver ARCHITECTURE.md seção 3."""
    return list(db.scalars(select(Exercise)))


@router.get("/{exercise_id}", response_model=ExercisePublic)
def get_exercise(exercise_id: str, db: Session = Depends(get_db)) -> Exercise | None:
    return db.get(Exercise, exercise_id)


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
    """Endpoint administrativo: registra a URL da sequência de pose recém
    publicada (ver backend/pipeline/publish_reference.py), fechando o ciclo
    de ingestão de vídeos de referência sem passo manual no banco."""
    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício não encontrado")

    exercise.reference_model_uri = str(payload.reference_model_uri)
    db.commit()
    db.refresh(exercise)
    return exercise
