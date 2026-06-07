from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models.base import Base

"""
Suite de testes da API (FastAPI TestClient + SQLite em memória).

Por que SQLite em vez do Postgres real de `DATABASE_URL`: os modelos só usam
tipos padrão (String/Integer/DateTime — ver app/models/*.py), então o SQLite
em memória é suficiente para testar o contrato HTTP sem exigir um Postgres
rodando localmente. `StaticPool` mantém a mesma conexão entre threads do
TestClient, o que é necessário para o SQLite `:memory:`.
"""

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(autouse=True)
def _reset_database() -> Generator[None, None, None]:
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    """Sessão direta no banco de teste — para preparar dados (ex.: exercícios
    do catálogo) que não têm endpoint de escrita pública na API."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def auth_headers(client: TestClient):
    """Registra e autentica um usuário de teste; retorna headers prontos
    para chamar endpoints protegidos por `get_current_user`."""

    def _make(name: str = "Maria Teste", email: str = "maria@example.com", password: str = "senha-forte-123") -> dict[str, str]:
        client.post("/auth/register", json={"name": name, "email": email, "password": password})
        login_response = client.post("/auth/login", json={"email": email, "password": password})
        token = login_response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _make
