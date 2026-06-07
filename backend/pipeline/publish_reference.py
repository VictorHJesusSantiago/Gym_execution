"""Publica uma sequência de pose já extraída: envia o JSON ao storage de
mídia (S3-compatível) e atualiza `reference_model_uri` do exercício.

Mantém o app desacoplado do pipeline: ele só consome a URL pública
(cacheável localmente), nunca o vídeo bruto nem o processo de geração
— ver ARCHITECTURE.md seções 3 e 5.

Uso:
    python publish_reference.py --exercise-id squat \
        --sequence-file squat_reference.json \
        --bucket gym-execution-reference-models

Pré-requisito: instalar `requirements-pipeline.txt` (boto3) e configurar
credenciais AWS via variáveis de ambiente / perfil — nunca hardcoded.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import boto3
except ImportError:  # pragma: no cover - guidance for local setup
    boto3 = None


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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exercise-id", required=True)
    parser.add_argument("--sequence-file", required=True, type=Path)
    parser.add_argument("--bucket", required=True)
    args = parser.parse_args()

    if not args.sequence_file.exists():
        sys.exit(f"Arquivo de sequência não encontrado: {args.sequence_file}")

    uri = upload_sequence(args.bucket, args.exercise_id, args.sequence_file)
    print(f"Publicado em: {uri}")
    print(
        "Próximo passo manual/automatizável: atualizar `reference_model_uri` "
        f"do exercício '{args.exercise_id}' (tabela `exercises`) com essa URI, "
        "via migration de dados ou endpoint administrativo (a criar)."
    )


if __name__ == "__main__":
    main()
