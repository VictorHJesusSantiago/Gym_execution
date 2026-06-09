# Gym Execution — App

App híbrido (React Native + Expo) — ver [arquitetura geral](../README.md#arquitetura).

Todas as telas planejadas estão implementadas: Login/Cadastro/Histórico
(ver seções "Autenticação" e "Histórico" abaixo) e também
Perfil/Configurações (ver seção "Perfil e Configurações").

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
    │   ├── HomeScreen.tsx        # + atalhos "Ver histórico", "Perfil", "Configurações"
    │   ├── ExerciseListScreen.tsx
    │   ├── ExecutionScreen.tsx   # placeholder p/ módulo de visão computacional
    │   ├── ResultScreen.tsx
    │   ├── HistoryScreen.tsx     # GET /sessions — histórico de treinos
    │   ├── ProfileScreen.tsx     # GET/PUT /users/me + estatísticas + logout
    │   └── SettingsScreen.tsx    # preferências locais (AsyncStorage)
    ├── services/
    │   ├── apiClient.ts          # fetch wrapper (base URL + Bearer token)
    │   ├── authService.ts        # consome /auth/register e /auth/login
    │   ├── authStorage.ts        # token JWT em armazenamento seguro (expo-secure-store)
    │   ├── sessionsService.ts    # consome GET/POST /sessions (histórico)
    │   ├── userService.ts        # consome GET/PUT /users/me (perfil)
    │   ├── profileStats.ts       # agrega "treinos realizados"/"pontuação média" (testável isoladamente)
    │   ├── preferencesStorage.ts # preferências locais via AsyncStorage
    │   ├── exerciseCatalog.ts
    │   ├── poseTypes.ts          # tipos/contrato do detector de pose (PoseDetector)
    │   ├── poseScoring.ts        # algoritmo de comparação de execução (ângulos + DTW)
    │   ├── mockPoseDetector.ts   # detector simulado p/ validar o fluxo sem libs nativas
    │   ├── moveNetAdapter.ts     # converte saída do MoveNet (17 kpts COCO) → formato MediaPipe (33), p/ integração futura
    │   ├── referenceLibrary.ts   # fonte das sequências de pose de referência
    │   └── __tests__/            # poseScoring, profileStats, preferencesStorage, moveNetAdapter (Jest)
    ├── hooks/
    │   ├── useAuth.tsx           # AuthProvider/useAuth — fonte única do estado de sessão
    │   └── usePoseSession.ts     # orquestra captura → scoring → resultado
    └── components/               # (vazio, para componentes reutilizáveis)
```

## Autenticação

`AuthProvider`
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
vazio e tratamento de erro.

A lista é **paginada** (`limit`/`offset`, ver
[sessionsService.ts](src/services/sessionsService.ts) e
`backend/app/routers/sessions.py`): a tela carrega páginas de
`SESSIONS_PAGE_SIZE` (20) itens e busca a próxima ao chegar perto do
fim da lista (`onEndReached` da FlatList, com indicador no rodapé).
`ProfileScreen` usa `listAllMySessions` (que percorre todas
as páginas) para calcular estatísticas agregadas, já que precisa do
histórico completo, não só da primeira página.

Para o histórico ter dados, `ExecutionScreen` agora também **registra**
o resultado ao final de cada série via `POST /sessions`
(`recordSession` em [sessionsService.ts](src/services/sessionsService.ts)),
enviando só o score calculado localmente — nunca o vídeo (mesma decisão
de privacidade/performance do [README.md raiz](../README.md#decisões-de-performance-alvo-2gb-ram-hardware-2015)). Falhas de rede
nesse envio não bloqueiam o feedback imediato ao usuário.

## Perfil e Configurações

`ProfileScreen` ([código](src/screens/ProfileScreen.tsx)) consome
`GET/PUT /users/me` ([userService.ts](src/services/userService.ts),
endpoint novo em `backend/app/routers/users.py`) para mostrar e editar
nome/e-mail, calcula "Treinos realizados" e "Pontuação média" a partir
de `GET /sessions` via [profileStats.ts](src/services/profileStats.ts)
(extraído da tela para ser testado isoladamente — mesmo padrão de
`poseScoring.ts` — ver [profileStats.test.ts](src/services/__tests__/profileStats.test.ts);
sem precisar de endpoint agregado no backend) e expõe o `signOut`.

`SettingsScreen` ([código](src/screens/SettingsScreen.tsx)) guarda
preferências **só no dispositivo** via `AsyncStorage`
([preferencesStorage.ts](src/services/preferencesStorage.ts)): qualidade
da câmera (Alta/Padrão/Economia — liga direto com a decisão de
performance do [README.md raiz](../README.md#decisões-de-performance-alvo-2gb-ram-hardware-2015)), som de feedback e modo
escuro. Cada alteração é salva imediatamente, sem botão de "salvar".
Testado com o mock oficial de `AsyncStorage` em
[preferencesStorage.test.ts](src/services/__tests__/preferencesStorage.test.ts)
(padrões, persistência, merge de dados parciais e recuperação de
conteúdo corrompido).

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
  `PoseDetector` usando `expo-camera`/`react-native-vision-camera` +
  MediaPipe Pose / TensorFlow Lite (MoveNet) — plano detalhado
  (bibliotecas, esqueleto de código, performance e cuidados de
  supply-chain) em [MEDIAPIPE_INTEGRATION_PLAN.md](src/services/MEDIAPIPE_INTEGRATION_PLAN.md).
  A parte que **não depende de pacotes nativos** já foi adiantada: a
  conversão do formato de saída do MoveNet (17 keypoints COCO) para o
  formato MediaPipe (33 landmarks) que `poseScoring.ts` espera —
  [moveNetAdapter.ts](src/services/moveNetAdapter.ts) + testes em
  [moveNetAdapter.test.ts](src/services/__tests__/moveNetAdapter.test.ts).
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

Todas as telas planejadas em `UX_PLAN.md` estão implementadas. O que
resta é o item já sinalizado como dependente de pacotes nativos:

- Integração real de câmera + inferência de pose, conforme
  `MEDIAPIPE_INTEGRATION_PLAN.md`.
