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

## Endpoints administrativos

`PUT /exercises/{id}/reference-model` — protegido pelo header
`X-Admin-Api-Key` (comparado em tempo constante, ver `core/deps.py`),
chamado pelo [pipeline de ingestão](pipeline/README.md) ao final do
processamento de um vídeo de referência, fechando o ciclo descrito em
`ARCHITECTURE.md` sem passo manual no banco.

## Roadmap

O ciclo completo descrito em `ARCHITECTURE.md` (autenticação, catálogo,
histórico, migrations e ingestão de referências) está coberto pelo
scaffold atual. Os próximos passos são de produto/escala (ex.: testes
de integração contra um banco real, paginação do histórico, rate
limiting), a detalhar conforme a prioridade do projeto evoluir.
