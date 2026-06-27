"""Exporta o schema OpenAPI da API para stdout como JSON.

Uso (da raiz do backend/):
    python scripts/export_openapi.py > ../openapi.json

Em seguida, no diretório app/:
    npx openapi-typescript ../openapi.json --output src/types/api.generated.ts

Integrado no CI via .github/workflows/ci.yml (step generate-types) para
manter os tipos TypeScript sincronizados com os schemas Pydantic do backend
sem drift manual (M5).
"""
import json
import sys

# Garante que o módulo app seja encontrado quando rodado de backend/
sys.path.insert(0, ".")

from app.main import app  # noqa: E402

print(json.dumps(app.openapi(), indent=2))
