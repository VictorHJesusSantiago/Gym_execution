# Gym Execution — App (scaffold)

Estrutura inicial do app híbrido (React Native + Expo), conforme
[ARCHITECTURE.md](../ARCHITECTURE.md).

## Estrutura

```
app/
├── App.tsx                      # entrada do app
├── app.json                     # configuração do Expo
├── babel.config.js
├── package.json                 # dependências (versões fixadas)
└── src/
    ├── navigation/AppNavigator.tsx
    ├── screens/
    │   ├── HomeScreen.tsx
    │   ├── ExerciseListScreen.tsx
    │   ├── ExecutionScreen.tsx   # placeholder p/ módulo de visão computacional
    │   └── ResultScreen.tsx
    ├── services/exerciseCatalog.ts
    ├── components/               # (vazio, para componentes reutilizáveis)
    └── hooks/                    # (vazio, para hooks customizados)
```

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
