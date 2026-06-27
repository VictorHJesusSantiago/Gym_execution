from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, Field, field_validator

_FUTURE_TOLERANCE = timedelta(minutes=5)


class TrainingSessionCreate(BaseModel):
    """Resultado de uma série calculado e enviado pelo app (não o vídeo bruto —
    o processamento de pose acontece no dispositivo, ver README.md seção 4)."""

    exercise_id: str
    score: int = Field(ge=0, le=100)
    executed_at: datetime
    weight_kg: float | None = Field(default=None, ge=0, le=1000)

    @field_validator("executed_at")
    @classmethod
    def _executed_at_not_in_future(cls, value: datetime) -> datetime:
        now = datetime.now(timezone.utc)
        if value > now + _FUTURE_TOLERANCE:
            raise ValueError("executed_at não pode estar no futuro")
        return value


class TrainingSessionPublic(BaseModel):
    id: str
    exercise_id: str
    score: int
    executed_at: datetime
    weight_kg: float | None = None

    model_config = {"from_attributes": True}


class SessionStats(BaseModel):
    """Agregados calculados server-side em uma query única — substitui a
    necessidade de buscar todas as sessões no cliente para exibir estatísticas."""

    total_sessions: int
    avg_score: float | None = None
    best_score: int | None = None
    exercises_count: int
