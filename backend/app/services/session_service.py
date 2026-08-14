from fastapi import HTTPException, status
from redis import Redis
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models.exercise import Exercise
from ..models.training_session import TrainingSession
from ..schemas.session import SessionStats, TrainingSessionCreate

_IDEMPOTENCY_PREFIX = "idempotency:session:"

_IDEMPOTENCY_TTL_SECONDS = 24 * 3600
"""Cobre com folga a janela em que um cliente ainda pode reenviar: a fila
offline drena ao abrir o histórico, então retries acontecem em horas, não dias.
Guardar para sempre transformaria o Redis num segundo banco de sessões."""


def record_session(
    db: Session,
    user_id: str,
    payload: TrainingSessionCreate,
    redis: Redis | None = None,
    idempotency_key: str | None = None,
) -> TrainingSession:
    if db.get(Exercise, payload.exercise_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"exercise_id '{payload.exercise_id}' não encontrado",
        )

    cache_key = (
        f"{_IDEMPOTENCY_PREFIX}{user_id}:{idempotency_key}"
        if redis is not None and idempotency_key
        else None
    )

    if cache_key is not None:
        existing_id = redis.get(cache_key)
        if existing_id is not None:
            existing = db.get(TrainingSession, existing_id)
            if existing is not None:
                return existing

    session = TrainingSession(
        user_id=user_id,
        exercise_id=payload.exercise_id,
        score=payload.score,
        executed_at=payload.executed_at,
        weight_kg=payload.weight_kg,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    if cache_key is not None:
        redis.set(cache_key, str(session.id), ex=_IDEMPOTENCY_TTL_SECONDS)

    return session


def list_user_sessions(
    db: Session, user_id: str, limit: int = 20, offset: int = 0
) -> list[TrainingSession]:
    stmt = (
        select(TrainingSession)
        .where(TrainingSession.user_id == user_id)
        .order_by(TrainingSession.executed_at.desc(), TrainingSession.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt))


def get_user_session_stats(db: Session, user_id: str) -> SessionStats:
    """Agrega estatísticas do usuário em uma única query — substitui o padrão
    anterior de buscar todas as sessões no cliente para calcular médias."""
    row = db.execute(
        select(
            func.count(TrainingSession.id).label("total_sessions"),
            func.avg(TrainingSession.score).label("avg_score"),
            func.max(TrainingSession.score).label("best_score"),
            func.count(func.distinct(TrainingSession.exercise_id)).label("exercises_count"),
        ).where(TrainingSession.user_id == user_id)
    ).one()

    return SessionStats(
        total_sessions=row.total_sessions or 0,
        avg_score=round(float(row.avg_score), 1) if row.avg_score is not None else None,
        best_score=row.best_score,
        exercises_count=row.exercises_count or 0,
    )
