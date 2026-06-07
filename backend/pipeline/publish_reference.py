"""Publica uma sequência de pose já extraída: envia o JSON ao storage de
mídia (S3-compatível) e registra `reference_model_uri` do exercício via
endpoint administrativo da API (PUT /exercises/{id}/reference-model).

Mantém o app desacoplado do pipeline: ele só consome a URL pública
(cacheável localmente), nunca o vídeo bruto nem o processo de geração
— ver ARCHITECTURE.md seções 3 e 5.

Uso:
    python publish_reference.py --exercise-id squat \
        --sequence-file squat_reference.json \
        --bucket gym-execution-reference-models \
        --api-url https://api.gymexecution.example.com \
        --admin-api-key "$GYM_ADMIN_API_KEY"

Pré-requisitos:
  - instalar `requirements-pipeline.txt` (boto3, requests) e configurar
    credenciais AWS via variáveis de ambiente / perfil — nunca hardcoded;
  - `--admin-api-key` deve vir de variável de ambiente/secrets manager,
    nunca em texto puro em scripts versionados (mesma chave configurada
    em `ADMIN_API_KEY` no backend, ver app/core/config.py).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import boto3
    import requests
except ImportError:  # pragma: no cover - guidance for local setup
    boto3 = None
    requests = None


def upload_sequence(bucket: str, exercise_id: str, sequence_file: Path) -> str:
    if boto3 is None:
        raise RuntimeError(
            "boto3 não instalado. Instale com `pip install -r requirements-pipeline.txt` "
            "(revise as versões/hashes antes — ver README.md)."
        )

    key = f"reference-models/{exercise_id}.json"
    s3_client = boto3.client("s3")
    s3_client.upload_file(
        Filename=str(sequence_file),
        Bucket=bucket,
        Key=key,
        ExtraArgs={"ContentType": "application/json", "CacheControl": "public, max-age=86400"},
    )
    return f"https://{bucket}.s3.amazonaws.com/{key}"


def register_reference_model_uri(api_url: str, admin_api_key: str, exercise_id: str, uri: str) -> None:
    if requests is None:
        raise RuntimeError(
            "requests não instalado. Instale com `pip install -r requirements-pipeline.txt`."
        )

    response = requests.put(
        f"{api_url.rstrip('/')}/exercises/{exercise_id}/reference-model",
        json={"reference_model_uri": uri},
        headers={"X-Admin-Api-Key": admin_api_key},
        timeout=10,
    )
    response.raise_for_status()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exercise-id", required=True)
    parser.add_argument("--sequence-file", required=True, type=Path)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--api-url", required=True, help="Base da API (ex.: https://api.exemplo.com)")
    parser.add_argument("--admin-api-key", required=True, help="Valor de ADMIN_API_KEY (via env, não hardcoded)")
    args = parser.parse_args()

    if not args.sequence_file.exists():
        sys.exit(f"Arquivo de sequência não encontrado: {args.sequence_file}")

    uri = upload_sequence(args.bucket, args.exercise_id, args.sequence_file)
    print(f"Publicado no storage: {uri}")

    register_reference_model_uri(args.api_url, args.admin_api_key, args.exercise_id, uri)
    print(f"Registrado em /exercises/{args.exercise_id}/reference-model — ciclo concluído.")


if __name__ == "__main__":
    main()
