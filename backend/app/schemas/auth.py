from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

ExperienceLevel = Literal["beginner", "intermediate", "advanced"]


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    goal: Optional[str] = None
    experience_level: Optional[ExperienceLevel] = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """PATCH /users/me — todos os campos são opcionais.
    `model_dump(exclude_unset=True)` no serviço garante que campos omitidos
    não sobrescrevam valores existentes (diferente do PUT antigo)."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    weight_kg: Optional[float] = Field(default=None, ge=0, le=500)
    height_cm: Optional[float] = Field(default=None, ge=0, le=300)
    goal: Optional[str] = Field(default=None, max_length=255)
    experience_level: Optional[ExperienceLevel] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
