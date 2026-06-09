from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, generate_uuid


class TrainingSession(Base, TimestampMixin):
    """Registro de uma série executada: apenas o score e metadados —
    o vídeo bruto não é enviado ao servidor (processamento on-device,
    ver README.md seção 4 e 5)."""

    __tablename__ = "training_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    exercise_id: Mapped[str] = mapped_column(String, ForeignKey("exercises.id"), nullable=False, index=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
