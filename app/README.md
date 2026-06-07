# Gym Execution — App (scaffold)

Estrutura inicial do app híbrido (React Native + Expo), conforme
[ARCHITECTURE.md](../ARCHITECTURE.md).

## Estrutura

```
app/
├── App.tsx                      # entrada do app
├── app.json                     # configuração do Expo
├── babel.config.js
├── tsconfig.json
├── package.json                 # dependências (versões fixadas) + config do Jest (preset jest-expo)
└── src/
    ├── navigation/AppNavigator.tsx
    ├── screens/
    │   ├── HomeScreen.tsx
    │   ├── ExerciseListScreen.tsx
    │   ├── ExecutionScreen.tsx   # placeholder p/ módulo de visão computacional
    │   └── ResultScreen.tsx
    ├── services/
    │   ├── exerciseCatalog.ts
    │   ├── poseTypes.ts          # tipos/contrato do detector de pose (PoseDetector)
    │   ├── poseScoring.ts        # algoritmo de comparação de execução (ângulos + DTW)
    │   ├── mockPoseDetector.ts   # detector simulado p/ validar o fluxo sem libs nativas
    │   └── referenceLibrary.ts   # fonte das sequências de pose de referência
    ├── hooks/usePoseSession.ts   # orquestra captura → scoring → resultado
    └── components/               # (vazio, para componentes reutilizáveis)
```

## Módulo de visão computacional (protótipo lógico)

A `ExecutionScreen` já roda o fluxo completo descrito em `ARCHITECTURE.md`
(seção 4) usando um **detector simulado** (`MockPoseDetector`):

1. Carrega o "modelo" → 2. Amostra frames periodicamente → 3. Acumula
landmarks → 4. Compara com a referência via `scoreExecution` (ângulos
articulares + Dynamic Time Warping) → 5. Mostra a porcentagem na tela
de resultado.

**O que falta para ser real** (cada item é um próximo passo independente,
que envolve instalar/buildar pacotes nativos — fazer com cautela e
revisão de supply-chain):

- Substituir `MockPoseDetector` por uma implementação real da interface
  `PoseDetector` usando `expo-camera` + MediaPipe Pose / TensorFlow Lite —
  plano detalhado (bibliotecas, esqueleto de código, mapeamento de
  keypoints, performance e cuidados de supply-chain) em
  [MEDIAPIPE_INTEGRATION_PLAN.md](src/services/MEDIAPIPE_INTEGRATION_PLAN.md).
- Substituir `getReferenceFrames` por consumo real da API do backend
  (vídeos de referência processados, cacheados localmente).

## Instalação (faça você mesmo, com revisão antes de instalar)

> ⚠️ **Atenção a supply-chain attacks** (como já ocorreu com pacotes do
> npm/pip): antes de instalar, confira se os nomes dos pacotes em
> `package.json` correspondem exatamente aos pacotes oficiais (sem
> typosquatting), revise o `package-lock.json` gerado, e prefira
> instalar com `npm ci` (respeita o lockfile) em vez de `npm install`.

```bash
cd app
npm install
npx expo start
```

## Próximo passo do roadmap

Implementar o módulo de captura de câmera + inferência de pose
(MediaPipe/TensorFlow Lite) dentro de `ExecutionScreen.tsx`, conforme
descrito em `ARCHITECTURE.md`, seção 4 (Fluxo principal).
