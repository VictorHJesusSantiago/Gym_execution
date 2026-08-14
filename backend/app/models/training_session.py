from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, generate_uuid

SCORE_MIN = 0
SCORE_MAX = 100


class TrainingSession(Base, TimestampMixin):
    """Registro de uma série executada: apenas o score e metadados —
    o vídeo bruto não é enviado ao servidor (processamento on-device,
    ver README.md seção 4 e 5)."""

    __tablename__ = "training_sessions"

    __table_args__ = (
        CheckConstraint(
            f"score >= {SCORE_MIN} AND score <= {SCORE_MAX}",
            name="ck_training_sessions_score_range",
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    exercise_id: Mapped[str] = mapped_column(String, ForeignKey("exercises.id"), nullable=False, index=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    """Carga usada na série (opcional, informada pelo usuário) — permite
    acompanhar progressão de carga ao longo do tempo no histórico."""
