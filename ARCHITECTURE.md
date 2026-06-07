# Arquitetura — App Híbrido de Academia com Visão Computacional

## 1. Objetivo
App híbrido (mobile + web mobile) que grava o usuário executando exercícios de
musculação/treino e retorna uma porcentagem de acerto da execução, comparando o
movimento capturado com padrões de referência (gerais e específicos por exercício).
Deve rodar de forma fluida em aparelhos a partir de 2GB de RAM (~2015+).

## 2. Stack escolhida (alinhada às ferramentas mais pedidas no mercado de TI)

| Camada | Ferramenta | Justificativa |
|---|---|---|
| App híbrido | **React Native + Expo** | Um único código-base para Android/iOS/Web; stack muito demandada; bom suporte a câmera |
| Visão computacional (no dispositivo) | **MediaPipe Pose + TensorFlow Lite** | Inferência local, leve, sem depender de internet — essencial em hardware fraco |
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
> `requirements.txt`/hashes, e preferir versões fixadas (pinned) em produção.

## 3. Visão geral dos componentes

```
┌─────────────────────────────┐
│   App (React Native/Expo)   │
│  - Captura de vídeo (câmera)│
│  - Inferência local         │
│    (MediaPipe + TFLite)     │
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

## 4. Fluxo principal (execução de um exercício)

1. Usuário seleciona um exercício no app → backend retorna metadados e o
   modelo de referência (TFLite) já cacheado/baixado localmente.
2. App ativa a câmera e roda a detecção de pose **localmente** (MediaPipe),
   extraindo pontos-chave (articulações) quadro a quadro.
3. A sequência de poses é comparada com o padrão de referência (algoritmo de
   similaridade — ex: distância angular entre articulações, DTW para alinhar
   no tempo) **no próprio dispositivo**, evitando enviar vídeo bruto.
4. App calcula uma porcentagem de execução correta (geral + por fase do
   movimento) e mostra feedback em tempo real ou ao final da série.
5. Apenas o resultado (score, métricas, opcionalmente um clipe curto) é
   enviado ao backend para histórico — minimizando tráfego de dados.

## 5. Decisões de performance (alvo: 2GB RAM, hardware ~2015)

- **Inferência on-device**: evita latência de rede e custo de upload de vídeo.
- **Modelos quantizados (INT8)** via TensorFlow Lite: reduzem uso de memória
  e CPU sem perda significativa de precisão para detecção de pose.
- **Resolução de captura reduzida** (ex: 480p) e taxa de quadros adaptativa
  conforme capacidade do aparelho.
- **Lazy loading** de vídeos/modelos de referência, com cache local.
- **Sem processamento de vídeo bruto no servidor** por padrão (custo e
  privacidade) — servidor só recebe métricas/scores.

## 6. Status e próximos passos

A maior parte do scaffold descrito neste documento já está implementada
(cada item abaixo coube em um escopo de cota separado — ver os READMEs
de cada diretório para os detalhes e links de código):

1. ✅ Scaffold do projeto React Native/Expo (estrutura de pastas,
   navegação pública/autenticada — ver [app/README.md](app/README.md)).
2. ✅ Protótipo do algoritmo de scoring (ângulos articulares + Dynamic
   Time Warping, ver `app/src/services/poseScoring.ts`) validado com um
   detector simulado (`MockPoseDetector`) — a inferência **real** com
   MediaPipe/TensorFlow Lite segue como plano detalhado em
   [app/src/services/MEDIAPIPE_INTEGRATION_PLAN.md](app/src/services/MEDIAPIPE_INTEGRATION_PLAN.md)
   (é o item que exige instalar pacotes nativos — feito por último,
   deliberadamente).
3. ✅ Scaffold do backend FastAPI (rotas de auth, usuários, exercícios,
   histórico — ver [backend/README.md](backend/README.md)) com suíte de
   testes (`pytest` + SQLite em memória).
4. ✅ Modelagem do banco de dados (usuários, exercícios, sessões de
   treino) com migrations Alembic.
5. ✅ Telas de conta/acompanhamento do app (Login, Cadastro, Histórico,
   Perfil, Configurações — ver [app/UX_PLAN.md](app/UX_PLAN.md)).
6. ✅ CI rodando os testes a cada push/PR
   ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

Planos prontos para as próximas fases (arquivos de configuração/teste já
escritos, nada instalado/executado ainda — ver tabela "Planos" em
[README.md](README.md)):

- [backend/INTEGRATION_TESTING_PLAN.md](backend/INTEGRATION_TESTING_PLAN.md) — testes contra Postgres real.
- [DEPLOY_PLAN.md](DEPLOY_PLAN.md) — containerização, hospedagem e build/distribuição via EAS.
- [app/src/services/MEDIAPIPE_INTEGRATION_PLAN.md](app/src/services/MEDIAPIPE_INTEGRATION_PLAN.md) — inferência de pose real.
