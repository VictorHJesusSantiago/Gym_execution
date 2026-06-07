# Gym Execution — Backend (scaffold)

API em FastAPI conforme [ARCHITECTURE.md](../ARCHITECTURE.md): autenticação,
catálogo de exercícios (com link para modelos de pose de referência) e
histórico de sessões de treino (apenas scores — nunca vídeo bruto).

## Estrutura

```
backend/
├── requirements.txt          # dependências (versões fixadas)
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
uvicorn app.main:app --reload
```

Variáveis de ambiente esperadas (`.env`, nunca commitar):
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, `MEDIA_STORAGE_URL`
(ver `app/core/config.py` para os valores padrão de desenvolvimento).

## Próximos passos do roadmap

- Migrations com Alembic para criar as tabelas (`users`, `exercises`,
  `training_sessions`) descritas em `app/models/`.
- Endpoint/processo de ingestão dos vídeos de referência → geração das
  sequências de pose (offline, processamento pesado no servidor) →
  publicação do `reference_model_uri` consumido pelo app.
