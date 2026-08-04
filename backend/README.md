# Gym Execution — Backend

API em FastAPI (ver [arquitetura geral](../README.md#arquitetura)):
autenticação, catálogo de exercícios (com link para modelos de pose de
referência) e histórico de sessões de treino (apenas scores — nunca
vídeo bruto).

## Estrutura

```
backend/
├── requirements.txt          # dependências (versões fixadas)
├── alembic.ini               # configuração do Alembic (migrations)
├── alembic/
│   ├── env.py                # usa a DATABASE_URL real da app (.env)
│   └── versions/
│       └── 0001_initial_schema.py  # cria users, exercises, training_sessions
└── app/
    ├── main.py               # ponto de entrada (FastAPI app + rotas)
    ├── core/
    │   ├── config.py         # configurações via variáveis de ambiente
    │   ├── database.py       # engine/sessão SQLAlchemy
    │   ├── security.py       # hash de senha (bcrypt) + JWT
    │   └── deps.py           # dependência de usuário autenticado
    ├── models/               # ORM (SQLAlchemy): User, Exercise, TrainingSession
    ├── schemas/              # contratos de entrada/saída (Pydantic)
    └── routers/
        ├── auth.py           # POST /auth/register, /auth/login
        ├── users.py          # GET/PUT /users/me (perfil do usuário autenticado)
        ├── exercises.py      # GET /exercises, /exercises/{id}
        └── sessions.py       # POST /sessions, GET /sessions (histórico)
```

```
backend/
├── pytest.ini                # roda a partir de backend/ (testpaths=tests)
└── tests/
    ├── conftest.py           # SQLite em memória + override de get_db + fixtures (client, auth_headers, db_session)
    ├── test_auth.py          # registro/login: sucesso, e-mail duplicado, credenciais inválidas
    ├── test_auth_refresh.py  # rotação, detecção de reuso, logout, token nunca em texto puro
    ├── test_users.py         # GET/PATCH /users/me: autenticação e persistência
    ├── test_sessions.py      # registro de sessão, validação de score, isolamento por usuário
    ├── test_exercises.py     # catálogo, 404, endpoint admin (chave correta/incorreta/ausente)
    ├── test_rate_limit.py    # 429 em /auth após AUTH_RATE_LIMIT (limiter religado só aqui)
    ├── test_account_deletion.py      # DELETE /users/me: apaga conta + histórico, revoga sessões
    ├── test_idempotency.py           # Idempotency-Key: retry não duplica sessão
    ├── test_observability.py         # X-Request-ID e métricas RED em /metrics
    ├── test_uuid_generation.py       # UUIDv7: versão, ordenação temporal, unicidade
    └── test_app_catalog_contract.py  # o catálogo embutido no app não pode divergir do seed
```

## Instalação (faça você mesmo, com revisão antes de instalar)

> ⚠️ **Atenção a supply-chain attacks** (como já ocorreu com pacotes do
> pip/npm): crie um ambiente virtual isolado, confira se os nomes dos
> pacotes em `requirements.txt` correspondem exatamente aos do PyPI
> oficial (sem typosquatting) e considere `pip-audit` para checar CVEs
> conhecidas antes de subir para produção.

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate        # Windows (PowerShell: .venv\Scripts\Activate.ps1)
pip install -r requirements.txt
cp .env.example .env            # criar e preencher com valores locais (ver abaixo)
alembic upgrade head            # aplica as migrations (cria as tabelas no banco)
uvicorn app.main:app --reload
```

Variáveis de ambiente esperadas (`.env`, nunca commitar):
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, `MEDIA_STORAGE_URL`,
`ADMIN_API_KEY` (ver `app/core/config.py` para os valores padrão de
desenvolvimento — gerar uma chave forte e aleatória em produção).

## Testes

```bash
cd backend
pytest                                        # 67 testes
ruff check .                                  # lint (ruff==0.6.9, só CI/dev)
pytest --cov=app --cov-fail-under=90          # gate de cobertura do CI (hoje: 94%)
```

Não é preciso Postgres nem Redis: `tests/conftest.py` usa SQLite em memória,
um dublê in-memory do Redis, e força `RATE_LIMIT_STORAGE_URI=memory://` **antes**
de importar `app.*` (a ordem importa — `Settings` e o `Limiter` são singletons
criados no import).

A suíte ([tests/](tests/)) usa `TestClient` do FastAPI com **SQLite em
memória** (ver [conftest.py](tests/conftest.py)) — não precisa do Postgres
de `DATABASE_URL` rodando, já que os modelos só usam tipos padrão
(`String`/`Integer`/`DateTime`). Cada teste roda em um banco limpo
(fixture `_reset_database` recria as tabelas a cada execução) e a fixture
`auth_headers` registra/loga um usuário de teste para exercitar rotas
protegidas por `get_current_user`.

Cobertura atual: registro/login (sucesso e rejeições), perfil
(`GET/PUT /users/me`, autenticação e persistência), sessões (contrato de
resposta — nunca expõe vídeo, validação de score 0-100, isolamento entre
usuários) e catálogo de exercícios (404, endpoint admin com
`X-Admin-Api-Key` correta/incorreta/ausente).

**Testes de integração contra Postgres real** (não rodam por padrão): usam
o [docker-compose.yml](../docker-compose.yml) da raiz (Postgres 16.4 +
Redis 7.4) e `tests/test_integration_postgres.py` (marcado
`@pytest.mark.integration`, pulado a menos que `RUN_INTEGRATION_TESTS=1`)
para validar garantias específicas do banco (ex.: constraints) que o
SQLite da suíte principal não cobre. Uso local:

```bash
docker compose up -d   # na raiz do repo
docker exec gym_execution-db-1 psql -U gym -d gym_execution -c "CREATE DATABASE gym_execution_test;"
cd backend
RUN_INTEGRATION_TESTS=1 INTEGRATION_DATABASE_URL=postgresql+psycopg2://gym:gym@localhost:5432/gym_execution_test pytest -m integration -k postgres
```

Validado nesta máquina (1 passed). Em CI, o job opcional
`backend-integration-tests` ([../.github/workflows/ci.yml](../.github/workflows/ci.yml))
roda essa mesma suíte contra um serviço Postgres, agendado semanalmente
ou sob demanda (`workflow_dispatch`) — não bloqueia PRs comuns por ser
mais lento e depender de infra externa.

## Endpoints administrativos

`PUT /exercises/{id}/reference-model` — protegido pelo header
`X-Admin-Api-Key` (comparado em tempo constante, ver `core/deps.py`),
chamado pelo [pipeline de ingestão](pipeline/README.md) ao final do
processamento de um vídeo de referência, fechando o ciclo de publicação
de modelos de referência sem passo manual no banco.

## Roadmap

O ciclo completo (autenticação, catálogo, histórico, migrations, ingestão
de referências, testes contra SQLite e Postgres real, containerização e
CI/CD — ver [README.md raiz, seção "Deploy"](../README.md#deploy)) está
coberto pelo scaffold atual.

**Paginação do histórico** já está implementada: `GET /sessions` aceita
`limit` (padrão 20, máx. 100) e `offset` (ver
[routers/sessions.py](app/routers/sessions.py) e
[tests/test_sessions.py](tests/test_sessions.py)); o app consome isso
em `HistoryScreen` com carregamento incremental (ver `app/README.md`,
seção "Histórico").

O catálogo de exercícios também ganhou um **seed inicial** via migration
de dados ([alembic/versions/0002_seed_exercise_catalog.py](alembic/versions/0002_seed_exercise_catalog.py),
testada em [tests/test_exercise_catalog_seed.py](tests/test_exercise_catalog_seed.py)) —
sem ele, uma instalação nova ficaria com `GET /exercises` vazio.

**Rate limiting** também está implementado: `/auth/register` e
`/auth/login` são limitados a `AUTH_RATE_LIMIT` (10/minuto) por IP via
`slowapi` (ver [core/rate_limit.py](app/core/rate_limit.py),
[main.py](app/main.py) e [tests/test_rate_limit.py](tests/test_rate_limit.py)),
retornando `429` com corpo JSON ao estourar — mitigação direta de força
bruta/credential stuffing nos dois endpoints públicos (sem autenticação
prévia) mais expostos a automação. Pode ser desligado via
`RATE_LIMIT_ENABLED=false` (ex.: nos testes, que registram dezenas de
usuários em sequência — ver `Settings.rate_limit_enabled` em `core/config.py`).

## Ambiente de desenvolvimento (testado nesta máquina)

Um `.venv` local foi criado e a suíte de testes roda de ponta a ponta
(**42 passam, 1 pulado** — o de integração com Postgres real):

```powershell
cd backend
python -m venv .venv
./.venv/Scripts/pip install -r requirements.txt   # ver nota sobre psycopg2 abaixo
$env:DATABASE_URL = "sqlite:///./test_run.db"     # evita exigir Postgres local p/ rodar os testes
./.venv/Scripts/python -m pytest -q
```

Notas de compatibilidade encontradas ao instalar de verdade — os pins em
`requirements.txt` já refletem os ajustes:

- **Python 3.14 não funciona**: `pydantic-core` 2.9.2 não publica wheel para
  `cp314` e o PyO3 dela recusa interpretadores acima de 3.13, então o build da
  fonte falha. Use **3.12** (a versão do CI) ou 3.13.
- **`pydantic`**: a versão originalmente fixada (2.7.4) não tem wheel
  pré-compilada para Python 3.13 — ajustada para `2.9.2` (compatível com
  `fastapi==0.111.0`/`pydantic-settings==2.3.4`).
- **`bcrypt`**: fixado em `4.2.0`, usado diretamente (`app/core/security.py`).
  O `passlib` foi **removido**: abandonado desde 2020 e incompatível com
  `bcrypt>=4.1`, que passou a levantar `ValueError` em vez de truncar senhas
  longas no autoteste interno do passlib.
- **`psycopg2-binary`**: ajustado de `2.9.9` (sem wheel para `cp313`/`cp314`)
  para `2.9.12` (tem wheel oficial para essas versões) — por padrão os
  testes usam `DATABASE_URL=sqlite:///...` (a suíte roda inteiramente
  sobre SQLite via `tests/conftest.py`); a conexão real com Postgres é
  exercida no teste de integração opcional (ver seção "Testes" acima),
  já validado com `psycopg2-binary==2.9.12` contra Postgres 16.4 real.
