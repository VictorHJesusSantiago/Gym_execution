#!/bin/sh
# Roda migrations antes de subir o servidor.
# Para deployment multi-réplica (k8s), mover `alembic upgrade head` para
# um initContainer ou job de CI pré-deploy — o lock de tabela do Alembic
# serializa múltiplas réplicas, mas pode estourar o timeout de healthcheck
# em provedores cloud com janelas apertadas.
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
