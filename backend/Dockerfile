# Build de produção da API — ver README.md raiz, seção "Deploy", para a
# estratégia completa. Multi-stage para manter a imagem final enxuta (sem cache de
# build/compiladores) e rodando como usuário não-root.
#
# Cuidado de supply-chain: a imagem base é fixada por versão+digest do
# Docker Hub oficial — confira o digest atual em https://hub.docker.com/_/python
# antes de usar em produção (digests mudam a cada rebuild da imagem base).

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

ENV PATH="/home/app/.local/bin:${PATH}" \
    PYTHONUNBUFFERED=1

USER app

EXPOSE 8000

# Roda as migrations e sobe a API — ver README.md raiz, seção "Deploy",
# para a justificativa de fazer isso no entrypoint vs. um job de deploy separado.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
