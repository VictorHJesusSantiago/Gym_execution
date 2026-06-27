from collections.abc import Generator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.redis import get_redis
from app.main import app
from app.models.base import Base

# Desliga o rate limiting nos testes: a suíte registra/loga dezenas de
# usuários em sequência (auth_headers é chamado em quase todo teste) e
# esbarraria no limite de /auth (AUTH_RATE_LIMIT) sem isso — o limite em
# si tem seu próprio teste em test_rate_limit.py com o limiter religado.
limiter.enabled = False

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


class _FakeRedis:
    """Substituto in-memory de redis.Redis para testes.

    Implementa apenas os métodos usados por auth_service: setex, get, delete.
    Não requer Redis instalado; cada fixture `client` parte de um estado limpo.
    """

    def __init__(self) -> None:
        self._store: dict[str, Any] = {}

    def setex(self, name: str, time: int, value: Any) -> None:  # noqa: ARG002
        self._store[name] = value

    def get(self, name: str) -> Any:
        return self._store.get(name)

    def delete(self, *names: str) -> int:
        deleted = 0
        for name in names:
            if name in self._store:
                del self._store[name]
                deleted += 1
        return deleted


_fake_redis = _FakeRedis()
app.dependency_overrides[get_redis] = lambda: _fake_redis


@pytest.fixture(autouse=True)
def _reset_database() -> Generator[None, None, None]:
    Base.metadata.create_all(bind=engine)
    _fake_redis._store.clear()
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
