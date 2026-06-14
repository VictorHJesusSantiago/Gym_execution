from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Campos editáveis pelo próprio usuário em `PUT /users/me`
    (ver README.md — tela de Perfil, "Editar perfil")."""

    name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
