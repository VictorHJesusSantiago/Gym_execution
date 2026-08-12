
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class Exercise(Base, TimestampMixin):
    __tablename__ = "exercises"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    muscle_group: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    reference_model_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    """Aponta para o storage de mídia (S3/CDN) onde fica a sequência de pose
    de referência pré-processada — distribuída e cacheada no app (README.md)."""
