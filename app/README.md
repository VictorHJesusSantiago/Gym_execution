# Gym Execution — App (scaffold)

Estrutura inicial do app híbrido (React Native + Expo), conforme
[ARCHITECTURE.md](../ARCHITECTURE.md).

> Telas de Login/Cadastro/Histórico já implementadas (ver seções
> "Autenticação" e "Histórico" abaixo). Perfil e Configurações continuam
> no plano — wireframes e roadmap em [UX_PLAN.md](UX_PLAN.md).

## Estrutura

```
app/
├── App.tsx                      # entrada do app
├── app.json                     # configuração do Expo
├── babel.config.js
├── tsconfig.json
├── package.json                 # dependências (versões fixadas) + config do Jest (preset jest-expo)
└── src/
    ├── navigation/AppNavigator.tsx   # alterna pilha pública/autenticada via useAuth
    ├── screens/
    │   ├── LoginScreen.tsx / RegisterScreen.tsx   # pilha pública
    │   ├── HomeScreen.tsx        # + atalhos "Ver histórico" e "Sair"
    │   ├── ExerciseListScreen.tsx
    │   ├── ExecutionScreen.tsx   # placeholder p/ módulo de visão computacional
    │   ├── ResultScreen.tsx
    │   └── HistoryScreen.tsx     # GET /sessions — histórico de treinos
    ├── services/
    │   ├── apiClient.ts          # fetch wrapper (base URL + Bearer token)
    │   ├── authService.ts        # consome /auth/register e /auth/login
    │   ├── authStorage.ts        # token JWT em armazenamento seguro (expo-secure-store)
    │   ├── sessionsService.ts    # consome GET/POST /sessions (histórico)
    │   ├── exerciseCatalog.ts
    │   ├── poseTypes.ts          # tipos/contrato do detector de pose (PoseDetector)
    │   ├── poseScoring.ts        # algoritmo de comparação de execução (ângulos + DTW)
    │   ├── mockPoseDetector.ts   # detector simulado p/ validar o fluxo sem libs nativas
    │   └── referenceLibrary.ts   # fonte das sequências de pose de referência
    ├── hooks/
    │   ├── useAuth.tsx           # AuthProvider/useAuth — fonte única do estado de sessão
    │   └── usePoseSession.ts     # orquestra captura → scoring → resultado
    └── components/               # (vazio, para componentes reutilizáveis)
```

## Autenticação

Implementada conforme `UX_PLAN.md` seções 1-2: `AuthProvider`
([useAuth.tsx](src/hooks/useAuth.tsx)) carrega o token persistido ao
abrir o app e expõe `signIn`/`signUp`/`signOut`; `AppNavigator` alterna
entre a pilha pública (`Login`/`Register`) e a autenticada conforme o
status da sessão — sem o usuário precisar navegar manualmente entre elas.

O token fica em `expo-secure-store` (Keychain/Android Keystore), nunca
em texto puro. **Nota de compatibilidade**: isso exige Android API 23+
(Android 6.0, fim de 2015) — por isso `app.json` foi ajustado de
`minSdkVersion` 21 para 23 (ver comentário em
[authStorage.ts](src/services/authStorage.ts)), uma pequena concessão
ao requisito de hardware antigo em troca de não expor o token.

A URL da API é lida de `EXPO_PUBLIC_API_BASE_URL` (variável de ambiente
pública do Expo — configurar no `.env` do app, ex.:
`EXPO_PUBLIC_API_BASE_URL=http://localhost:8000`).

## Histórico

`HistoryScreen` ([código](src/screens/HistoryScreen.tsx)) lista as
sessões do usuário via `GET /sessions`, reaproveitando o padrão visual
de `ExerciseListScreen` (FlatList + card), com pull-to-refresh, estado
vazio e tratamento de erro — conforme `UX_PLAN.md` seção 3.

Para o histórico ter dados, `ExecutionScreen` agora também **registra**
o resultado ao final de cada série via `POST /sessions`
(`recordSession` em [sessionsService.ts](src/services/sessionsService.ts)),
enviando só o score calculado localmente — nunca o vídeo (mesma decisão
de privacidade/performance do `ARCHITECTURE.md` seção 5). Falhas de rede
nesse envio não bloqueiam o feedback imediato ao usuário.

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

## Próximos passos do roadmap

- Telas de Perfil e Configurações (`UX_PLAN.md`; Login, Cadastro e
  Histórico já prontos). Perfil depende de um novo endpoint
  `GET/PUT /users/me` — ainda não existe no backend.
- Integração real de câmera + inferência de pose, conforme
  `MEDIAPIPE_INTEGRATION_PLAN.md`.
