import os

os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("RATE_LIMIT_STORAGE_URI", "memory://")

from collections.abc import Generator  # noqa: E402
from typing import Any  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.database import get_db  # noqa: E402
from app.core.redis import get_redis  # noqa: E402
from app.main import app  # noqa: E402
from app.models.base import Base  # noqa: E402

"""
Suite de testes da API (FastAPI TestClient + SQLite em memória).

Por que SQLite em vez do Postgres real de `DATABASE_URL`: os modelos só usam
tipos padrão (String/Integer/DateTime — ver app/models/*.py), então o SQLite
em memória é suficiente para testar o contrato HTTP sem exigir um Postgres
rodando localmente. `StaticPool` mantém a mesma conexão entre threads do
TestClient, o que é necessário para o SQLite `:memory:`.

O rate limiting fica desligado (via env acima) porque `auth_headers` é usado em
quase todo teste e a suíte estouraria AUTH_RATE_LIMIT; o limite em si tem seu
próprio teste em test_rate_limit.py, que o religa sobre storage `memory://`.
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

    Implementa a fatia da API que `auth_service` usa: strings (`set`/`get`/
    `delete`/`expire`) e conjuntos (`sadd`/`srem`/`smembers`), imitando
    `decode_responses=True` (tudo entra e sai como str).

    O TTL é aceito e ignorado: nenhum teste depende de expiração por tempo, e
    fingir passagem de tempo aqui só criaria testes lentos ou instáveis.

    Nota: este dublê é o ponto exato onde a suíte já mentiu uma vez — ele tinha
    `setex` enquanto o serviço chamava `set(..., ex=...)`, e todo teste que
    passava por /auth/login morria com AttributeError. Ao mexer em
    `auth_service`, confira se os métodos usados existem aqui.
    """

    def __init__(self) -> None:
        self._strings: dict[str, str] = {}
        self._sets: dict[str, set[str]] = {}

    def set(self, name: str, value: Any, ex: int | None = None) -> None:  # noqa: ARG002
        self._strings[name] = str(value)

    def get(self, name: str) -> str | None:
        return self._strings.get(name)

    def delete(self, *names: str) -> int:
        deleted = 0
        for name in names:
            deleted += self._strings.pop(name, None) is not None
            deleted += self._sets.pop(name, None) is not None
        return deleted

    def expire(self, name: str, seconds: int) -> bool:  # noqa: ARG002
        return name in self._strings or name in self._sets

    def sadd(self, name: str, *values: str) -> int:
        members = self._sets.setdefault(name, set())
        before = len(members)
        members.update(str(value) for value in values)
        return len(members) - before

    def srem(self, name: str, *values: str) -> int:
        members = self._sets.get(name)
        if members is None:
            return 0
        before = len(members)
        members.difference_update(str(value) for value in values)
        return before - len(members)

    def smembers(self, name: str) -> "set[str]":
        return {*self._sets.get(name, ())}

    def clear(self) -> None:
        self._strings.clear()
        self._sets.clear()


_fake_redis = _FakeRedis()
app.dependency_overrides[get_redis] = lambda: _fake_redis


@pytest.fixture(autouse=True)
def _reset_database() -> Generator[None, None, None]:
    Base.metadata.create_all(bind=engine)
    _fake_redis.clear()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def fake_redis() -> _FakeRedis:
    """Acesso ao dublê do Redis para testes que precisam inspecionar o estado
    das sessões (ex.: garantir que o refresh token não é guardado em texto puro)."""
    return _fake_redis


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


@pytest.fixture()
def login_tokens(client: TestClient):
    """Registra/loga um usuário e devolve o par completo de tokens — para os
    testes de rotação e revogação de refresh token."""

    def _make(email: str = "rota@example.com", password: str = "senha-forte-123") -> dict[str, str]:
        client.post("/auth/register", json={"name": "Rota Teste", "email": email, "password": password})
        response = client.post("/auth/login", json={"email": email, "password": password})
        return response.json()

    return _make
