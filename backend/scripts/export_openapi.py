"""Exporta o schema OpenAPI da API para stdout como JSON.

Uso (da raiz do backend/):
    python scripts/export_openapi.py > ../openapi.json

Em seguida, no diretório app/:
    npx openapi-typescript ../openapi.json --output src/types/api.generated.ts

⚠️ Passo MANUAL hoje. A geração de tipos ainda NÃO roda no CI (não existe step
`generate-types` em .github/workflows/ci.yml, apesar de este cabeçalho ter
afirmado o contrário), e `openapi.json` não é versionado — por isso
`npm run generate:types` falha num checkout limpo até se rodar o comando acima.
Enquanto isso, os tipos do app são escritos à mão espelhando os schemas
Pydantic (ver o comentário em app/src/services/authService.ts).
"""
import json
import sys

# Garante que o módulo app seja encontrado quando rodado de backend/
sys.path.insert(0, ".")

from app.main import app  # noqa: E402

print(json.dumps(app.openapi(), indent=2))
