# Gym Execution — Backend (scaffold)

API em FastAPI conforme [ARCHITECTURE.md](../ARCHITECTURE.md): autenticação,
catálogo de exercícios (com link para modelos de pose de referência) e
histórico de sessões de treino (apenas scores — nunca vídeo bruto).

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
    ├── test_users.py         # GET/PUT /users/me: autenticação e persistência
    ├── test_sessions.py      # registro de sessão, validação de score, isolamento por usuário
    └── test_exercises.py     # catálogo, 404, endpoint admin (chave correta/incorreta/ausente)
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
pytest
```

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

## Endpoints administrativos

`PUT /exercises/{id}/reference-model` — protegido pelo header
`X-Admin-Api-Key` (comparado em tempo constante, ver `core/deps.py`),
chamado pelo [pipeline de ingestão](pipeline/README.md) ao final do
processamento de um vídeo de referência, fechando o ciclo descrito em
`ARCHITECTURE.md` sem passo manual no banco.

## Roadmap

O ciclo completo descrito em `ARCHITECTURE.md` (autenticação, catálogo,
histórico, migrations, ingestão de referências e testes da API — ver
seção "Testes" acima) está coberto pelo scaffold atual. Os próximos
passos são de produto/escala (ex.: rodar a suíte também contra um
Postgres real via `testcontainers` para pegar diferenças de dialeto,
paginação do histórico, rate limiting), a detalhar conforme a
prioridade do projeto evoluir.
