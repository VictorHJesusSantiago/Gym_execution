"""Testes de integração contra um Postgres real (ver INTEGRATION_TESTING_PLAN.md).

Não rodam por padrão — exigem RUN_INTEGRATION_TESTS=1 e um Postgres
acessível via INTEGRATION_DATABASE_URL (ex.: `docker compose up -d db`
na raiz do projeto). Isso evita que `pytest` comum, sem infraestrutura
externa, falhe tentando conectar a um banco que não existe.

O foco aqui é validar garantias *específicas do banco* (constraints,
comportamento de transação) que o SQLite em memória da suíte principal
(tests/conftest.py) não consegue verificar — não duplicar os testes de
contrato HTTP, que já são cobertos igualmente bem ali.
"""

import os

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.user import User

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.environ.get("RUN_INTEGRATION_TESTS") != "1",
        reason=(
            "Defina RUN_INTEGRATION_TESTS=1 com um Postgres real disponível "
            "(ver docker-compose.yml e INTEGRATION_TESTING_PLAN.md)."
        ),
    ),
]

INTEGRATION_DATABASE_URL = os.environ.get(
    "INTEGRATION_DATABASE_URL",
    "postgresql+psycopg2://gym:gym@localhost:5432/gym_execution_test",
)


@pytest.fixture()
def pg_session():
    engine = create_engine(INTEGRATION_DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_email_uniqueness_is_enforced_by_postgres(pg_session):
    """Garante que `unique=True` em User.email vira mesmo uma constraint
    no banco — não só uma checagem da camada de aplicação (que o router
    de auth também faz, ver test_auth.py::test_register_rejects_duplicate_email)."""
    pg_session.add(User(name="Ana", email="ana@example.com", password_hash="hash"))
    pg_session.commit()

    pg_session.add(User(name="Outra Ana", email="ana@example.com", password_hash="hash2"))
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()

    exists = pg_session.scalar(select(User).where(User.email == "ana@example.com").exists().select())
    assert exists is True
