from datetime import datetime

from pydantic import BaseModel, Field


class TrainingSessionCreate(BaseModel):
    """Resultado de uma série, calculado e enviado pelo app (não o vídeo bruto —
    o processamento de pose acontece no dispositivo, ver ARCHITECTURE.md seção 4)."""

    exercise_id: str
    score: int = Field(ge=0, le=100)
    executed_at: datetime


class TrainingSessionPublic(BaseModel):
    id: str
    exercise_id: str
    score: int
    executed_at: datetime

    model_config = {"from_attributes": True}
