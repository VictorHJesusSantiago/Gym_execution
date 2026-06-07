# Plano de deploy / CI-CD

Este documento descreve como levar o backend e o app para produção e
estender o pipeline de CI ([.github/workflows/ci.yml](.github/workflows/ci.yml),
que hoje só roda os testes) até o deploy — usando ferramentas entre as
mais pedidas em vagas de plataforma/DevOps (Docker, GitHub Actions,
Postgres/Redis gerenciados, EAS para apps Expo).

**Status**: plano + arquivos de build prontos
([backend/Dockerfile](backend/Dockerfile), [docker-compose.yml](docker-compose.yml)
para uso local). **Nada é construído, publicado ou implantado agora** —
isso envolve criar contas em provedores externos, gerar credenciais e
rodar `docker build`/`eas build`, decisões que cabem a quem for operar o
projeto e que ficam fora do escopo de "só preparar o terreno" sem
ultrapassar a cota combinada.

## 1. Visão geral da topologia de produção

```
                    ┌──────────────────────┐
   App (mobile) ───▶│   API (FastAPI)      │───▶ Postgres (gerenciado)
   App (web)    ───▶│   container Docker   │───▶ Redis (gerenciado)
                    │   ver backend/Dockerfile
                    └──────────────────────┘
                              ▲
                              │ imagem publicada por
                    ┌──────────────────────┐
                    │  CI/CD (GitHub Actions)│
                    └──────────────────────┘

   App (mobile): binários gerados via EAS Build → lojas (Play/App Store)
   App (web): export estático do Expo → hospedagem de site estático
```

## 2. Backend: containerização

[backend/Dockerfile](backend/Dockerfile) — build multi-stage (compila
dependências numa camada, copia só o necessário para a imagem final),
roda como usuário não-root, expõe `:8000`. [backend/.dockerignore](backend/.dockerignore)
evita copiar `.venv/`, testes, `.env` etc. para dentro da imagem.

```bash
# build e execução local (não rodar agora — só quando for operar de fato)
docker build -t gym-execution-api:local backend/
docker run --rm -p 8000:8000 --env-file backend/.env gym-execution-api:local
```

> ⚠️ Supply-chain: a imagem base `python:3.12-slim` vem do Docker Hub
> oficial. Para builds reprodutíveis, fixe por digest
> (`python:3.12-slim@sha256:...`) e rode um scanner de vulnerabilidades
> (ex.: `docker scout` ou Trivy/Grype) antes de publicar — mesma postura
> de revisão já aplicada a `requirements.txt`/`package.json`.

## 3. Onde hospedar o backend

Recomendação: uma plataforma com Postgres/Redis gerenciados e deploy a
partir de imagem Docker — reduz a superfície operacional (sem gerenciar
servidores/patches de SO). Opções equivalentes e populares no mercado:
**Railway**, **Render** ou **Fly.io**. Critérios para escolher:

- Suporte a Postgres/Redis gerenciados com backup automático.
- Deploy via imagem Docker publicada por CI (não via `git push` direto —
  mantém o histórico de builds auditável).
- Variáveis de ambiente/segredos configuráveis fora do repositório
  (nunca commitar `.env` — ver [.gitignore](.gitignore) e `.env.example`).

`alembic upgrade head` roda no entrypoint do container (ver `CMD` do
Dockerfile) — simples e correto para uma API com uma única réplica
ativa por vez. Se o projeto crescer para múltiplas réplicas simultâneas,
mover as migrations para um *job* de deploy separado (roda uma vez,
antes de escalar a API), evitando condições de corrida entre réplicas
tentando migrar ao mesmo tempo.

## 4. App: build e distribuição (Expo/EAS)

O app já é Expo — o caminho oficial de build/distribuição é o
**EAS (Expo Application Services)**:

- **Mobile** (`eas build`): gera binários assinados (`.apk`/`.aab` para
  Android, `.ipa` para iOS) a partir do mesmo código-fonte, sem precisar
  de macOS local para builds iOS. Publicação nas lojas via `eas submit`.
- **Web** (`npx expo export --platform web`): gera um build estático
  (HTML/JS/CSS) que pode ser hospedado em qualquer serviço de site
  estático (Cloudflare Pages, Netlify, Vercel, S3+CDN).
- **Atualizações incrementais** (`eas update`): publica mudanças de JS
  sem passar pela revisão das lojas — útil para correções rápidas
  (revisar o que pode/não pode mudar via OTA conforme as regras de cada loja).

> ⚠️ Supply-chain: `eas-cli` é um pacote oficial da Expo — mesmo cuidado
> de conferir o nome exato no npm e revisar antes de instalar
> globalmente (`npm install -g eas-cli`).

## 5. Extensão do CI/CD (GitHub Actions)

O workflow atual roda testes em todo push/PR. A extensão de deploy entra
como **jobs adicionais, condicionados a push em `main`** (não em PRs —
evita publicar artefatos de branches não revisadas):

```yaml
# trecho a adicionar a .github/workflows/ci.yml

  build-and-push-backend-image:
    name: Build & publicar imagem da API
    needs: backend-tests          # só publica se os testes passarem
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write             # publica no GitHub Container Registry (ghcr.io)
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: backend
          push: true
          tags: ghcr.io/${{ github.repository }}/api:${{ github.sha }}

  deploy-backend:
    name: Deploy da API
    needs: build-and-push-backend-image
    runs-on: ubuntu-latest
    steps:
      - name: Acionar deploy no provedor escolhido
        run: |
          echo "Placeholder: cada provedor (Railway/Render/Fly.io) tem sua"
          echo "própria action ou CLI — ex.: 'flyctl deploy --image ghcr.io/...'"
          echo "Credenciais via secrets do repositório, nunca hardcoded."

  build-app-web:
    name: Build estático do app (web)
    needs: app-tests
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm, cache-dependency-path: app/package-lock.json }
      - run: npm ci
      - run: npx expo export --platform web
      - name: Publicar em hospedagem estática
        run: echo "Placeholder: action do provedor escolhido (Cloudflare Pages/Netlify/Vercel)"
```

Notas sobre as actions citadas: `docker/setup-buildx-action`,
`docker/login-action` e `docker/build-push-action` são mantidas
oficialmente pela Docker — mesmo critério de "só actions oficiais,
fixadas por versão" já usado no workflow de testes.

### Builds do app mobile (EAS) ficam fora do GitHub Actions "puro"

`eas build` roda na infraestrutura da Expo (não em runners do GitHub) —
a integração recomendada é o **EAS Workflows** (CI nativo da Expo) ou um
job que apenas *aciona* o build via `eas-cli` autenticado por token
(`secrets.EXPO_TOKEN`). Como builds nativos consomem cota paga da Expo,
recomenda-se acioná-los manualmente ou por tag de release — não em todo
push — para não gerar custo/builds desnecessários.

## 6. Segredos e variáveis de ambiente em produção

- Nunca commitar `.env` (ver [.gitignore](.gitignore) — já configurado).
- `JWT_SECRET_KEY` e `ADMIN_API_KEY` de produção devem ser gerados com
  `python -c "import secrets; print(secrets.token_urlsafe(64))"` e
  armazenados nos *secrets* do provedor de hospedagem e do GitHub
  Actions — nunca reaproveitar os valores de desenvolvimento.
- `EXPO_PUBLIC_API_BASE_URL` do app de produção deve apontar para a URL
  pública da API hospedada (não `localhost`).

## 7. Resumo do que falta para "ligar" este plano

1. Escolher o provedor de hospedagem do backend (seção 3) e criar a conta/projeto.
2. Configurar os secrets necessários no GitHub (registry, credenciais do provedor, EXPO_TOKEN).
3. Adicionar os jobs da seção 5 ao `ci.yml` (ou um workflow `deploy.yml` separado, disparado só em `push` para `main`/tags).
4. Criar o projeto EAS (`eas init`) quando for a hora de gerar os primeiros builds mobile.

Cada um desses passos exige criar contas/credenciais em serviços
externos — fora do escopo de "só preparar o terreno sem gastar cota".
