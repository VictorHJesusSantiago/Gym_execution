from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Campos editáveis pelo próprio usuário em `PUT /users/me`
    (ver UX_PLAN.md — tela de Perfil, "Editar perfil")."""

    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
