# Gym Execution

Aplicativo híbrido (mobile + web) de academia com visão computacional:
grava a execução de exercícios pela câmera do celular e dá um percentual
de acerto (geral e específico por exercício), processando tudo
**no próprio dispositivo** — vídeo bruto nunca sai do telefone.

## Arquitetura

### Objetivo

App híbrido (mobile + web) que grava o usuário executando exercícios de
musculação/treino e retorna uma porcentagem de acerto da execução,
comparando o movimento capturado com padrões de referência (gerais e
específicos por exercício). Roda de forma fluida em aparelhos a partir de
2GB de RAM (~2015+).

### Stack (alinhada às ferramentas mais pedidas no mercado de TI)

| Camada | Ferramenta | Justificativa |
|---|---|---|
| App híbrido | **React Native + Expo** | Um único código-base para Android/iOS/Web; stack muito demandada; bom suporte a câmera |
| Visão computacional (no dispositivo) | **MediaPipe Pose (web, `@mediapipe/tasks-vision`) / MoveNet via TensorFlow Lite (mobile, `react-native-fast-tflite`)** | Inferência local, leve, sem depender de internet — essencial em hardware fraco |
| Treinamento de modelo (servidor) | **Python + PyTorch**, exportado para TFLite/ONNX | Separa processamento pesado (nuvem) de inferência leve (celular) |
| Backend / API | **Python + FastAPI** | Leve, rápida, tipagem com Pydantic, muito pedida no mercado |
| Banco de dados | **PostgreSQL** | Relacional, robusto, padrão de mercado para dados de usuários/treinos |
| Cache / sessões | **Redis** | Reduz latência em consultas repetidas (ex: vídeos de referência) |
| Armazenamento de mídia | **S3-compatível (ex: AWS S3 / MinIO self-hosted)** + CDN | Vídeos de referência e gravações, com cache para economizar dados móveis |
| Containerização / deploy | **Docker + GitHub Actions (CI/CD)** | Padrão de mercado, facilita deploy reproduzível |
| Versionamento | **Git/GitHub** | Universal |
| Testes | **Pytest** (backend) / **Jest** (frontend) | Padrão em vagas de qualquer stack |

> ⚠️ Cuidado com supply-chain: instalar pacotes apenas de fontes oficiais
> (PyPI/npm), conferir nomes (typosquatting), revisar `package-lock.json` /
> `requirements.txt`/hashes, e preferir versões fixadas (pinned) em produção
> — ver seção "Cuidado com supply-chain attacks" no final deste arquivo.

### Componentes

```
┌─────────────────────────────┐
│   App (React Native/Expo)   │
│  - Captura de vídeo (câmera)│
│  - Inferência local          │
│    (MediaPipe / MoveNet)     │
│  - UI de feedback (% score) │
└──────────────┬──────────────┘
               │ HTTPS (REST/JSON)
┌──────────────▼──────────────┐
│      Backend (FastAPI)      │
│  - Autenticação de usuário  │
│  - Histórico de treinos     │
│  - Catálogo de exercícios   │
│  - Distribuição de modelos  │
│    de referência (TFLite)   │
└──────┬─────────────┬────────┘
       │             │
┌──────▼─────┐ ┌─────▼──────┐
│ PostgreSQL │ │   Redis    │
│ (dados)    │ │  (cache)   │
└────────────┘ └────────────┘
       │
┌──────▼─────────────┐
│ Storage de mídia    │
│ (S3 / MinIO + CDN)  │
│ - vídeos de         │
│   referência        │
│ - clipes do usuário │
│   (opcional/local)  │
└─────────────────────┘
```

### Fluxo principal (execução de um exercício)

1. Usuário seleciona um exercício no app → backend retorna metadados e o
   modelo de referência (TFLite) já cacheado/baixado localmente.
2. App ativa a câmera e roda a detecção de pose **localmente**
   (MediaPipe/MoveNet), extraindo pontos-chave (articulações) quadro a quadro.
3. A sequência de poses é comparada com o padrão de referência (algoritmo de
   similaridade — distância angular entre articulações + Dynamic Time
   Warping para alinhar no tempo) **no próprio dispositivo**, evitando
   enviar vídeo bruto.
4. App calcula uma porcentagem de execução correta e mostra feedback ao
   final da série.
5. Apenas o resultado (score, métricas) é enviado ao backend para
   histórico — minimizando tráfego de dados.

### Decisões de performance (alvo: 2GB RAM, hardware ~2015)

- **Inferência on-device**: evita latência de rede e custo de upload de vídeo.
- **Modelos quantizados (INT8)** via TensorFlow Lite: reduzem uso de memória
  e CPU sem perda significativa de precisão para detecção de pose.
- **Resolução de captura reduzida** e amostragem a ~10 fps
  (`SAMPLE_INTERVAL_MS` em `ExecutionScreen.tsx`).
- **Sem processamento de vídeo bruto no servidor** — servidor só recebe
  métricas/scores.

## Estrutura do repositório

| Diretório | O quê | Documentação |
|---|---|---|
| [app/](app/) | App React Native + Expo (mobile + web), telas, captura/scoring de pose | [app/README.md](app/README.md) |
| [backend/](backend/) | API FastAPI: autenticação, catálogo de exercícios, histórico de sessões | [backend/README.md](backend/README.md) |
| [backend/pipeline/](backend/pipeline/) | Pipeline offline de ingestão de vídeos de referência → sequências de pose | [backend/pipeline/README.md](backend/pipeline/README.md) |

## Status de implementação

- ✅ App React Native/Expo: navegação pública/autenticada, telas de
  conta/acompanhamento (Login, Cadastro, Histórico paginado, Perfil,
  Configurações) — ver [app/README.md](app/README.md).
- ✅ Algoritmo de scoring (ângulos articulares + Dynamic Time Warping,
  `app/src/services/poseScoring.ts`).
- ✅ Detecção de pose real: `@mediapipe/tasks-vision` na versão web e
  `MoveNetPoseDetector` (TensorFlow Lite via `react-native-fast-tflite`
  + `expo-camera`) no mobile — ver "Módulo de visão computacional" em
  [app/README.md](app/README.md).
- ✅ Backend FastAPI (auth, usuários, catálogo de exercícios, histórico),
  com migrations Alembic e suíte `pytest` (SQLite em memória + teste de
  integração contra Postgres real) — ver [backend/README.md](backend/README.md).
- ✅ Rate limiting (`slowapi`) em `/auth/register` e `/auth/login`.
- ✅ Containerização (`backend/Dockerfile`, `docker-compose.yml`),
  validada localmente: build da imagem + `docker run` contra
  Postgres/Redis reais (migrations + `/health` + auth funcionando).
- ✅ CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)): testes do
  backend e do app a cada push/PR; job opcional de testes de integração
  contra Postgres (`schedule`/`workflow_dispatch`); jobs de build da
  imagem Docker (ghcr.io) e do export web, com deploy ainda como
  placeholder (ver seção "Deploy" abaixo).

## Deploy

### Backend: containerização

[backend/Dockerfile](backend/Dockerfile) — build multi-stage (compila
dependências numa camada, copia só o necessário para a imagem final),
roda como usuário não-root, expõe `:8000`. [backend/.dockerignore](backend/.dockerignore)
evita copiar `.venv/`, testes, `.env` etc. para dentro da imagem.
`alembic upgrade head` roda no entrypoint do container (`CMD` do
Dockerfile) — simples e correto para uma API com uma única réplica ativa
por vez.

```bash
docker build -t gym-execution-api:local backend/
docker run --rm -p 8000:8000 --env-file backend/.env gym-execution-api:local
```

> ⚠️ Supply-chain: a imagem base `python:3.12-slim` vem do Docker Hub
> oficial. Para builds reprodutíveis, fixe por digest
> (`python:3.12-slim@sha256:...`) e rode um scanner de vulnerabilidades
> (ex.: `docker scout` ou Trivy/Grype) antes de publicar.

### Onde hospedar o backend

Recomendação: uma plataforma com Postgres/Redis gerenciados e deploy a
partir de imagem Docker — reduz a superfície operacional. Opções
populares: **Railway**, **Render** ou **Fly.io**. Critérios:

- Suporte a Postgres/Redis gerenciados com backup automático.
- Deploy via imagem Docker publicada por CI (não via `git push` direto —
  mantém o histórico de builds auditável).
- Variáveis de ambiente/segredos configuráveis fora do repositório
  (nunca commitar `.env` — ver [.gitignore](.gitignore) e `.env.example`).

**Status**: nenhum provedor foi escolhido/contratado ainda — o job
`deploy-backend` em `ci.yml` é um placeholder que loga essa pendência;
substituir pelo CLI/action do provedor escolhido quando houver conta e
secrets configurados.

### App: build e distribuição (Expo/EAS)

- **Mobile** (`eas build`, configurado em [app/eas.json](app/eas.json)):
  gera binários assinados (`.apk`/`.aab` Android, `.ipa` iOS) a partir do
  mesmo código-fonte. Publicação nas lojas via `eas submit`. Requer
  `expo-dev-client` (já incluso, ver `app/package.json`) porque o app usa
  módulos nativos customizados (`react-native-fast-tflite`) — não roda no
  Expo Go.
- **Web** (`npx expo export --platform web`): gera um build estático
  (HTML/JS/CSS), validado localmente com sucesso. Pode ser hospedado em
  qualquer serviço de site estático (Cloudflare Pages, Netlify, Vercel,
  S3+CDN) — o job `build-app-web` em `ci.yml` já gera esse artefato; falta
  só escolher a hospedagem (placeholder no job).
- **Atualizações incrementais** (`eas update`): publica mudanças de JS
  sem passar pela revisão das lojas.

> ⚠️ Supply-chain: `eas-cli` é um pacote oficial da Expo — mesmo cuidado
> de conferir o nome exato no npm antes de instalar globalmente
> (`npm install -g eas-cli`).

### CI/CD (GitHub Actions)

[.github/workflows/ci.yml](.github/workflows/ci.yml) roda, a cada
push/PR para `main`: testes do backend (`pytest`) e do app (`jest`). Em
push para `main`, dois jobs adicionais publicam artefatos:
`build-and-push-backend-image` (publica `ghcr.io/<repo>/api:<sha>`) e
`build-app-web` (gera o export estático). Os jobs `deploy-backend` e a
etapa de "publicar em hospedagem estática" são placeholders até um
provedor ser escolhido (ver seções acima). Um job opcional
`backend-integration-tests` roda em `schedule` (segunda-feira) ou
`workflow_dispatch`, contra um Postgres real de serviço.

### Segredos e variáveis de ambiente em produção

- Nunca commitar `.env` (ver [.gitignore](.gitignore) — já configurado).
- `JWT_SECRET_KEY` e `ADMIN_API_KEY` de produção devem ser gerados com
  `python -c "import secrets; print(secrets.token_urlsafe(64))"` e
  armazenados nos *secrets* do provedor de hospedagem e do GitHub
  Actions — nunca reaproveitar os valores de desenvolvimento.
- `EXPO_PUBLIC_API_BASE_URL` do app de produção deve apontar para a URL
  pública da API hospedada (não `localhost`).

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
duas suítes a cada push/PR para `main`, usando só actions oficiais
(`actions/*`, `docker/*`) fixadas por versão — mesma postura de cautela
com supply-chain do resto do projeto.

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
