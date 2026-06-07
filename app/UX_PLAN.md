# Plano de telas/UX — status: implementado

> Todas as telas listadas abaixo (Login, Cadastro, Histórico, Perfil e
> Configurações) já foram implementadas — ver [README.md](README.md)
> seções "Autenticação", "Histórico" e "Perfil e Configurações" para os
> links de código. Este documento permanece como registro do plano
> original (wireframes e fluxo de navegação que guiaram a implementação).

O scaffold cobre o fluxo central (Home → Lista de exercícios →
Execução → Resultado, ver [AppNavigator.tsx](src/navigation/AppNavigator.tsx))
e as telas de **conta** e **acompanhamento**, que conectam o app aos
endpoints do backend (`/auth`, `/users`, `/sessions`, ver
[backend/README.md](../backend/README.md)).

## 1. Telas a adicionar

| Tela | Rota proposta | Endpoint(s) consumidos | Status |
|---|---|---|---|
| Login | `Login` | `POST /auth/login` | ✅ [LoginScreen.tsx](src/screens/LoginScreen.tsx) |
| Cadastro | `Register` | `POST /auth/register` | ✅ [RegisterScreen.tsx](src/screens/RegisterScreen.tsx) |
| Histórico de treinos | `History` | `GET /sessions` | ✅ [HistoryScreen.tsx](src/screens/HistoryScreen.tsx) |
| Perfil | `Profile` | `GET/PUT /users/me` | ✅ [ProfileScreen.tsx](src/screens/ProfileScreen.tsx) — endpoint criado em `backend/app/routers/users.py` |
| Configurações | `Settings` | local (`AsyncStorage`, ver [preferencesStorage.ts](src/services/preferencesStorage.ts)) | ✅ [SettingsScreen.tsx](src/screens/SettingsScreen.tsx) |

## 2. Fluxo de navegação atualizado

```
                     ┌──────────┐
                     │  Login   │──── "Criar conta" ──▶ ┌──────────┐
                     └────┬─────┘                       │ Register │
                          │ login OK                    └────┬─────┘
                          │                ◀── volta ────────┘
                          ▼
                     ┌──────────┐
              ┌─────▶│   Home   │◀─────────────┐
              │      └────┬─────┘              │
              │           │                    │
       "Configurações"    │ "Começar treino"   │ "Voltar ao início"
              │           ▼                    │
       ┌──────┴───┐ ┌──────────────┐           │
       │ Settings │ │ ExerciseList │           │
       └──────────┘ └──────┬───────┘           │
                           ▼                   │
                    ┌─────────────┐    ┌────────┴──┐
                    │  Execution  │───▶│  Result   │
                    └─────────────┘    └───────────┘

       Home ──"Ver histórico"──▶ History ──item──▶ (detalhe futuro)
       Home ──"Perfil"─────────▶ Profile
```

**Mudança estrutural**: o `Stack.Navigator` precisa de duas pilhas —
uma pública (Login/Register) e uma autenticada (o restante) — trocando
de uma para outra conforme o estado de autenticação. Padrão recomendado
do React Navigation: renderizar condicionalmente o `Navigator` certo a
partir de um contexto/hook de sessão (`useAuth`), por exemplo:

```tsx
// AppNavigator.tsx (esqueleto da mudança)
const { isAuthenticated } = useAuth();
return (
  <NavigationContainer>
    {isAuthenticated ? <AuthenticatedStack /> : <PublicStack />}
  </NavigationContainer>
);
```

Isso introduz a necessidade de um `AuthContext`/`useAuth` (armazenando o
token JWT recebido de `/auth/login`, persistido com `expo-secure-store`
para não expor em texto puro) — um novo serviço a planejar quando formos
implementar.

## 3. Wireframes (texto/ASCII)

### Login
```
┌─────────────────────────────┐
│        Gym Execution        │
│                             │
│  E-mail                     │
│  ┌───────────────────────┐  │
│  └───────────────────────┘  │
│  Senha                      │
│  ┌───────────────────────┐  │
│  └───────────────────────┘  │
│                             │
│      [   Entrar   ]         │
│                             │
│   Não tem conta? Criar conta│
└─────────────────────────────┘
```

### Cadastro (Register)
```
┌─────────────────────────────┐
│         Criar conta         │
│                             │
│  Nome                       │
│  ┌───────────────────────┐  │
│  └───────────────────────┘  │
│  E-mail                     │
│  ┌───────────────────────┐  │
│  └───────────────────────┘  │
│  Senha                      │
│  ┌───────────────────────┐  │
│  └───────────────────────┘  │
│                             │
│      [  Criar conta  ]      │
│                             │
│   Já tem conta? Entrar      │
└─────────────────────────────┘
```

### Histórico (History)
```
┌─────────────────────────────┐
│          Histórico          │
│                             │
│  Agachamento          92%   │
│  07/06/2026 às 18:40        │
│  ─────────────────────────  │
│  Flexão de braço      78%   │
│  06/06/2026 às 19:10        │
│  ─────────────────────────  │
│  Levantamento terra   85%   │
│  05/06/2026 às 18:55        │
│                             │
│      (lista paginada)       │
└─────────────────────────────┘
```
> Reaproveita o mesmo padrão visual de lista de `ExerciseListScreen`
> ([código atual](src/screens/ExerciseListScreen.tsx)) — `FlatList` +
> item em card — mantendo consistência de UI com baixo esforço.

### Perfil (Profile)
```
┌─────────────────────────────┐
│           Perfil            │
│                             │
│         (avatar)            │
│        Nome do usuário      │
│        email@exemplo.com    │
│                             │
│  Treinos realizados:   24   │
│  Pontuação média:      83%  │
│                             │
│      [   Editar perfil  ]   │
│      [       Sair       ]   │
└─────────────────────────────┘
```

### Configurações (Settings)
```
┌─────────────────────────────┐
│        Configurações        │
│                             │
│  Qualidade da câmera        │
│   ( ) Alta  (•) Padrão  ( ) Economia │
│                             │
│  Som de feedback      [ON] │
│  Modo escuro          [OFF]│
│                             │
│      [   Sobre o app   ]    │
└─────────────────────────────┘
```
> "Qualidade da câmera" conecta diretamente com a decisão de performance
> em `ARCHITECTURE.md` (seção 5) — permite ao usuário de hardware mais
> fraco escolher resolução/taxa de amostragem menor manualmente.

## 4. Novo tipo de navegação (`RootStackParamList` estendido)

```ts
export type PublicStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AuthenticatedStackParamList = {
  Home: undefined;
  ExerciseList: undefined;
  Execution: { exerciseId: string };
  Result: { score: number; exerciseId: string };
  History: undefined;
  Profile: undefined;
  Settings: undefined;
};
```

## 5. Passos de implementação (todos concluídos, na ordem em que foram feitos)

1. ✅ `AuthContext`/`useAuth` (estado de sessão + armazenamento seguro do
   token com `expo-secure-store`) e `apiClient.ts` (fetch wrapper com
   `Authorization: Bearer <token>`).
2. ✅ `LoginScreen` e `RegisterScreen`, consumindo `/auth/*`.
3. ✅ `AppNavigator` dividido em pilha pública/autenticada conforme seção 2.
4. ✅ `HistoryScreen` consumindo `GET /sessions` (reaproveitando o padrão
   de lista existente).
5. ✅ `ProfileScreen` — exigiu criar o endpoint `GET/PUT /users/me` no
   backend (`backend/app/routers/users.py`, registrado em `main.py` e
   documentado em `backend/README.md`).
6. ✅ `SettingsScreen` com preferências locais (`AsyncStorage` via
   `preferencesStorage.ts`), incluindo a opção de qualidade de câmera
   mencionada acima.

## 6. Cuidados de supply-chain ao implementar

As novas dependências previstas (`expo-secure-store`, `@react-native-async-storage/async-storage`)
são pacotes oficiais do ecossistema Expo/React Native — ainda assim,
seguir o mesmo cuidado já documentado: conferir nomes exatos no npm
oficial, revisar o lockfile e preferir `npm ci` na instalação (ver
[README.md](README.md)).
