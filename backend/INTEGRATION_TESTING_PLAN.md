# Plano: testes de integração contra um banco real

A suíte atual ([tests/](tests/), ver [README.md](README.md#testes)) roda
com **SQLite em memória** — rápida e suficiente para validar o contrato
HTTP, já que os modelos só usam tipos padrão (`String`/`Integer`/`DateTime`).
Mas ela não pega diferenças de dialeto entre SQLite e o **Postgres real**
de produção (`DATABASE_URL`): por exemplo, `unique=True` em `User.email`
se comporta igual nos dois, mas tipos mais específicos (JSONB, arrays,
constraints/triggers a nível de banco) só seriam validados contra o
Postgres de verdade.

Este documento é só o plano + arquivos prontos — **nada é instalado ou
executado agora** (ver aviso de cota/supply-chain no topo do projeto).
Quem for rodar decide quando instalar, com a mesma revisão de sempre.

## 1. Estratégia escolhida: docker-compose + suíte separada

Duas abordagens comuns: `testcontainers-python` (sobe um container
descartável por sessão de teste, via Docker) ou um Postgres já rodando
(docker-compose local / serviço de CI) que os testes apontam via env var.

**Escolha**: a segunda — reaproveita o `docker-compose.yml` já criado
([../docker-compose.yml](../docker-compose.yml)) para desenvolvimento
local, evita adicionar `testcontainers` às dependências (menos uma
superfície de supply-chain) e mapeia direto para como o CI roda serviços
(`services:` do GitHub Actions, ver seção 4).

## 2. Como ficam os testes de integração

Arquivo novo, **não roda por padrão** — só quando `RUN_INTEGRATION_TESTS=1`
estiver definido (evita que `pytest` comum exija um Postgres rodando):

```python
# backend/tests/test_integration_postgres.py
import os

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.user import User

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_INTEGRATION_TESTS") != "1",
    reason="Defina RUN_INTEGRATION_TESTS=1 com um Postgres real disponível "
    "(ver docker-compose.yml e INTEGRATION_TESTING_PLAN.md).",
)

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
    """Garante que a constraint `unique=True` de User.email vira mesmo
    uma constraint no banco — não só uma checagem da aplicação."""
    from sqlalchemy.exc import IntegrityError

    pg_session.add(User(name="Ana", email="ana@example.com", password_hash="hash"))
    pg_session.commit()

    pg_session.add(User(name="Outra Ana", email="ana@example.com", password_hash="hash2"))
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()

    count = pg_session.scalar(select(User).where(User.email == "ana@example.com").exists().select())
    assert count is True
```

> Por que um teste de exemplo só (não a suíte inteira duplicada): o valor
> de testar contra Postgres real está nas garantias *específicas do banco*
> (constraints, tipos, comportamento de transação) — não em repetir os
> mesmos testes de contrato HTTP que o SQLite já cobre igualmente bem.
> Conforme o projeto crescer (ex.: se usar `JSONB` ou full-text search),
> adicionar testes aqui para essas features específicas.

## 3. `docker-compose.yml` para desenvolvimento e testes locais

```yaml
# docker-compose.yml (raiz do projeto)
services:
  db:
    image: postgres:16.4
    environment:
      POSTGRES_USER: gym
      POSTGRES_PASSWORD: gym
      POSTGRES_DB: gym_execution
    ports:
      - "5432:5432"
    volumes:
      - gym_execution_db:/var/lib/postgresql/data

  redis:
    image: redis:7.4
    ports:
      - "6379:6379"

volumes:
  gym_execution_db:
```

Uso local:

```bash
docker compose up -d
cd backend
createdb -h localhost -U gym gym_execution_test   # banco isolado p/ integração
RUN_INTEGRATION_TESTS=1 pytest -m integration -k postgres
```

> ⚠️ Imagens oficiais (`postgres`, `redis`) do Docker Hub, fixadas por
> versão — mesma cautela de supply-chain do resto do projeto. Considere
> fixar por digest (`postgres:16.4@sha256:...`) para builds reprodutíveis.

## 4. Extensão futura do CI

O workflow atual ([.github/workflows/ci.yml](../.github/workflows/ci.yml))
roda só a suíte SQLite (rápida, em todo PR). A suíte de integração entra
como um job **separado e opcional** — não bloqueia PRs comuns, mas roda
sob demanda ou em schedule:

```yaml
# trecho a adicionar a .github/workflows/ci.yml (job novo)
  backend-integration-tests:
    name: Backend (integração — Postgres real)
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16.4
        env:
          POSTGRES_USER: gym
          POSTGRES_PASSWORD: gym
          POSTGRES_DB: gym_execution_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12", cache: pip, cache-dependency-path: backend/requirements.txt }
      - run: pip install -r requirements.txt
      - run: pytest -m integration
        env:
          RUN_INTEGRATION_TESTS: "1"
          INTEGRATION_DATABASE_URL: postgresql+psycopg2://gym:gym@localhost:5432/gym_execution_test

  # e no topo do arquivo, adicionar o gatilho:
  # on:
  #   schedule:
  #     - cron: "0 6 * * 1"   # toda segunda às 06:00 UTC
  #   workflow_dispatch: {}
```

Por que separado: testes contra serviço real são mais lentos e mais
frágeis (dependem de infra externa) — rodar em todo push deixaria o
feedback do PR mais lento sem ganho proporcional. Rodar sob demanda
(`workflow_dispatch`) ou em schedule pega regressões de dialeto sem
travar o fluxo do dia a dia.

## 5. Resumo do que falta para "ligar" este plano

1. Criar `docker-compose.yml` na raiz (conteúdo da seção 3).
2. Criar `backend/tests/test_integration_postgres.py` (conteúdo da seção 2)
   e registrar o marker `integration` em `backend/pytest.ini`
   (`markers = integration: requer Postgres real, ver INTEGRATION_TESTING_PLAN.md`).
3. Adicionar o job opcional ao CI (seção 4) quando o projeto tiver infra
   de CI própria (self-hosted runners ou orçamento de Actions) para
   rodá-lo com regularidade.

Nenhum desses passos exige instalar pacotes Python novos — só Docker
(para o Postgres local) e a infraestrutura de CI já usada pelo projeto.
