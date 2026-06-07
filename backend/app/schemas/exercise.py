from typing import Optional

from pydantic import BaseModel, HttpUrl


class ExerciseReferenceModelUpdate(BaseModel):
    """Payload do endpoint administrativo chamado ao final do pipeline de
    ingestão (ver backend/pipeline/publish_reference.py), após a sequência
    de pose ser publicada no storage de mídia."""

    reference_model_uri: HttpUrl


class ExercisePublic(BaseModel):
    id: str
    name: str
    muscle_group: str
    description: Optional[str] = None
    reference_model_uri: Optional[str] = None
    """URI do modelo de referência (sequência de pose) cacheável no app,
    conforme ARCHITECTURE.md seção 3 (distribuição de modelos)."""

    model_config = {"from_attributes": True}
