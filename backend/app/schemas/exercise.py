from typing import Optional

from pydantic import BaseModel


class ExercisePublic(BaseModel):
    id: str
    name: str
    muscle_group: str
    description: Optional[str] = None
    reference_model_uri: Optional[str] = None
    """URI do modelo de referência (sequência de pose) cacheável no app,
    conforme ARCHITECTURE.md seção 3 (distribuição de modelos)."""

    model_config = {"from_attributes": True}
