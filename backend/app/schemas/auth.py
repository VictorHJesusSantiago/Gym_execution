from typing import Literal

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
    weight_kg: float | None = None
    height_cm: float | None = None
    goal: str | None = None
    experience_level: ExperienceLevel | None = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """PATCH /users/me — todos os campos são opcionais.
    `model_dump(exclude_unset=True)` no serviço garante que campos omitidos
    não sobrescrevam valores existentes (diferente do PUT antigo)."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    weight_kg: float | None = Field(default=None, ge=0, le=500)
    height_cm: float | None = Field(default=None, ge=0, le=300)
    goal: str | None = Field(default=None, max_length=255)
    experience_level: ExperienceLevel | None = None


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
