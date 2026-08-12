from fastapi import HTTPException, status
from pydantic import HttpUrl
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.exercise import Exercise


def list_exercises(db: Session, limit: int = 100, offset: int = 0) -> list[Exercise]:
    # ORDER BY obrigatório: LIMIT/OFFSET sobre um conjunto sem ordenação total
    # tem ordem indefinida no Postgres, então páginas consecutivas podiam repetir
    # ou pular exercícios. `id` no fim garante desempate determinístico mesmo
    # entre nomes iguais dentro de um grupo muscular.
    stmt = (
        select(Exercise)
        .order_by(Exercise.muscle_group, Exercise.name, Exercise.id)
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt))


def get_exercise(db: Session, exercise_id: str) -> Exercise:
    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício não encontrado")
    return exercise


def update_exercise_reference_model(db: Session, exercise_id: str, uri: HttpUrl) -> Exercise:
    exercise = get_exercise(db, exercise_id)
    exercise.reference_model_uri = str(uri)
    db.commit()
    db.refresh(exercise)
    return exercise
