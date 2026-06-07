# Gym Execution

Aplicativo híbrido (mobile + web) de academia com visão computacional:
grava a execução de exercícios pela câmera do celular e dá um percentual
de acerto (geral e específico por exercício), processando tudo
**no próprio dispositivo** — vídeo bruto nunca sai do telefone.

Veja [ARCHITECTURE.md](ARCHITECTURE.md) para a visão completa da stack,
fluxo de execução e decisões de performance (alvo: aparelhos com 2GB de
RAM a partir de 2015).

## Estrutura do repositório

| Diretório | O quê | Documentação |
|---|---|---|
| [app/](app/) | App React Native + Expo (mobile + web), telas, captura/scoring de pose | [app/README.md](app/README.md), [app/UX_PLAN.md](app/UX_PLAN.md) |
| [backend/](backend/) | API FastAPI: autenticação, catálogo de exercícios, histórico de sessões | [backend/README.md](backend/README.md) |
| [backend/pipeline/](backend/pipeline/) | Pipeline offline de ingestão de vídeos de referência → sequências de pose | [backend/pipeline/README.md](backend/pipeline/README.md) |

## Começando

Cada sub-projeto documenta sua própria instalação (com o cuidado de
supply-chain descrito abaixo). Resumo:

```bash
# Backend (API)
cd backend
cp .env.example .env   # preencher com valores locais
python -m venv .venv && . .venv/Scripts/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# App (em outro terminal)
cd app
cp .env.example .env   # apontar EXPO_PUBLIC_API_BASE_URL para a API acima
npm ci
npx expo start
```

## Testes e integração contínua

- Backend: `cd backend && pytest` ([detalhes](backend/README.md#testes))
- App: `cd app && npm test` ([detalhes](app/README.md))

O workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) roda as
duas suítes a cada push/PR para `main`, usando só actions oficiais do
GitHub (`actions/checkout`, `actions/setup-python`, `actions/setup-node`)
fixadas por versão — mesma postura de cautela com supply-chain do resto
do projeto.

> **Nota**: o workflow do app usa `npm ci`, que exige um
> `package-lock.json` commitado. Gere-o na primeira instalação
> (`npm install` cria/atualiza o lockfile) e commite-o junto.

## Cuidado com supply-chain attacks

Como já aconteceu com pacotes do pip, npm e outros gerenciadores: antes
de instalar qualquer dependência, confira se o nome corresponde
exatamente ao pacote oficial (sem typosquatting), revise o lockfile
gerado e prefira instaladores que respeitam o lockfile (`npm ci`,
`pip install -r requirements.txt --require-hashes`). Detalhes específicos
de cada stack estão nos READMEs de [app/](app/README.md) e
[backend/](backend/README.md).

`.env` reais nunca devem ser commitados — use `.env.example` como
referência (ambos os diretórios têm um) e confira o [.gitignore](.gitignore).
