# Build de produção da API — multi-stage para manter a imagem final enxuta
# e rodando como usuário não-root.
#
# SUPPLY-CHAIN: fixar por digest além da tag antes de ir para produção:
#   docker pull python:3.12-slim
#   docker inspect python:3.12-slim --format='{{index .RepoDigests 0}}'
# Substitua as linhas FROM abaixo pelo resultado, ex:
#   FROM python:3.12-slim@sha256:<digest> AS builder
# O digest muda a cada rebuild da imagem base no Docker Hub.

FROM python:3.12-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim

RUN useradd --create-home --shell /bin/bash app
WORKDIR /app

COPY --from=builder /root/.local /home/app/.local
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY entrypoint.sh ./

RUN chmod +x entrypoint.sh

ENV PATH="/home/app/.local/bin:${PATH}" \
    PYTHONUNBUFFERED=1

USER app

EXPOSE 8000

# /health/live (não /health): o healthcheck do Docker reinicia o contêiner ao
# falhar, então precisa medir só o processo. Indisponibilidade de banco é
# readiness (/health/ready) e deve ser tratada pelo balanceador, não por
# restart — ver app/main.py.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8000/health/live || exit 1

# entrypoint.sh: roda `alembic upgrade head` + uvicorn com set -e.
# Para multi-réplica, extrair a migration para job separado — ver comentário
# em entrypoint.sh.
CMD ["./entrypoint.sh"]
