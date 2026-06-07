# Plano: substituir o `MockPoseDetector` pela integração real (MediaPipe/TFLite)

Este documento detalha **como** trocar o detector simulado
([mockPoseDetector.ts](mockPoseDetector.ts)) por uma implementação real,
sem alterar o restante do app — graças à interface `PoseDetector`
definida em [poseTypes.ts](poseTypes.ts). Nenhum pacote é instalado aqui;
isso fica para uma rodada futura, com a revisão de supply-chain descrita
no final.

## 1. Por que a interface já isola essa troca

`usePoseSession` ([usePoseSession.ts](../hooks/usePoseSession.ts)) e
`ExecutionScreen` só conhecem o contrato `PoseDetector` (`load`, `detect`,
`dispose`) e o tipo `PoseFrame`. Bastará:

```ts
// ExecutionScreen.tsx
const detector = useMemo(() => new MediaPipePoseDetector(), []);
// no lugar de: new MockPoseDetector()
```

## 2. Opções de biblioteca (avaliar ao decidir)

| Opção | Prós | Contras |
|---|---|---|
| **`react-native-vision-camera` + plugin de frame processor com MediaPipe Tasks (Pose Landmarker, modelo `pose_landmarker_lite.task` quantizado)** | Processamento direto nos frames da câmera, melhor performance em hardware fraco | Requer `expo-dev-client`/build nativo (não funciona no Expo Go); plugin precisa de binding nativo (Kotlin/Swift) |
| **`expo-camera` + `react-native-fast-tflite`** rodando um modelo de pose exportado para TFLite (ex.: MoveNet Lightning, INT8) | Mais simples de integrar com Expo, modelo pequeno (~3MB) | Menos pronto-para-uso que o pipeline oficial do MediaPipe; requer escrever o pré/pós-processamento dos tensores |
| **`@mediapipe/tasks-vision` (build web/WASM)** — só para a versão **web** do app | Reaproveita o mesmo pipeline da Google sem binding nativo | Não roda em iOS/Android nativos; serviria só para a versão web/PWA |

> Recomendação inicial: para mobile, `expo-camera` + `react-native-fast-tflite`
> com **MoveNet Lightning (INT8)** — modelo pequeno e rápido o bastante para
> os aparelhos de 2GB RAM citados em `ARCHITECTURE.md`. Para a versão web,
> usar `@mediapipe/tasks-vision`. Ambas implementam `PoseDetector`, então
> o app escolhe a implementação certa por plataforma (`Platform.OS`).

## 3. Esqueleto da implementação real

```ts
// mediaPipePoseDetector.ts (nome final a definir conforme a lib escolhida)
import { PoseDetector, PoseFrame, Landmark } from './poseTypes';
// import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
// import { useFrameProcessor } from 'react-native-vision-camera'; // se for essa a rota

export class MediaPipePoseDetector implements PoseDetector {
  // private model: TensorflowModel | null = null;

  async load(): Promise<void> {
    // this.model = await loadTensorflowModel(require('../assets/models/movenet_lightning_int8.tflite'));
  }

  async detect(timestampMs: number): Promise<PoseFrame | null> {
    // 1. obter o frame atual da câmera (via frame processor / ImageCapture)
    // 2. redimensionar/normalizar para a entrada do modelo (ex.: 192x192 RGB)
    // 3. rodar `this.model.runSync([inputTensor])`
    // 4. mapear a saída (17 keypoints do MoveNet OU 33 do MediaPipe Pose)
    //    para o formato `Landmark[]` em `poseTypes.ts`
    // 5. retornar { timestampMs, landmarks }
    return null;
  }

  dispose(): void {
    // this.model = null;
  }
}
```

### Atenção ao mapeamento de keypoints

O MoveNet usa **17** keypoints (formato COCO), enquanto `LANDMARK_INDEX`
em `poseTypes.ts` segue os **33** do MediaPipe Pose. Caso opte pelo
MoveNet, será necessário **adaptar `LANDMARK_INDEX` e `ANGLE_TRIPLETS`**
em [poseScoring.ts](poseScoring.ts) para o novo índice — ou escrever uma
função de conversão MoveNet→MediaPipe antes de retornar o `PoseFrame`,
preservando o restante do app sem alterações. A segunda opção é mais
simples de manter (concentra a tradução em um único ponto).

## 4. Onde plugar a câmera na `ExecutionScreen`

Hoje a tela simula o laço de captura com `setInterval` (ver
[ExecutionScreen.tsx](../screens/ExecutionScreen.tsx), linhas 40-46). A
integração real troca isso por:

```tsx
// usando react-native-vision-camera (se essa for a rota escolhida)
const frameProcessor = useFrameProcessor((frame) => {
  'worklet';
  // roda o modelo no worklet (thread separada — não trava a UI)
  // chama captureFrame(frame.timestamp) de forma compatível com worklets
}, [captureFrame]);

return <Camera frameProcessor={frameProcessor} ... />;
```

Ou, com `expo-camera` simples (sem frame processor nativo), capturando
fotos periódicas via `takePictureAsync` — opção mais simples, porém com
mais latência (avaliar se atende ao requisito de feedback em tempo real).

## 5. Performance no hardware-alvo (2GB RAM, ~2015+)

- Preferir modelos **quantizados (INT8)**: MoveNet Lightning INT8 (~3MB)
  ou Pose Landmarker Lite do MediaPipe Tasks.
- Rodar a inferência a **~10 fps** (mesmo `SAMPLE_INTERVAL_MS = 100` já
  usado no protótipo) — suficiente para capturar a fase do movimento sem
  sobrecarregar a CPU.
- Capturar em resolução reduzida (ex.: 480p) antes de redimensionar para
  a entrada do modelo.
- Medir o tempo de inferência por frame em dispositivos de referência
  (ex.: Moto G de 2015/2016 com 2GB) e ajustar `SAMPLE_INTERVAL_MS` se
  necessário.

## 6. Passos de implementação (ordem sugerida)

1. Decidir a biblioteca (tabela da seção 2) — validar se será preciso
   `expo-dev-client`/build nativo (Expo Go não roda módulos nativos
   customizados).
2. Adicionar as dependências ao `package.json` **com revisão de
   supply-chain** (ver seção 7) e gerar/baixar o modelo `.tflite`/`.task`
   de uma fonte oficial (TensorFlow Hub / Google AI Edge), conferindo o
   hash do arquivo.
3. Implementar `MediaPipePoseDetector`/`MoveNetPoseDetector` seguindo o
   esqueleto da seção 3, incluindo o mapeamento de keypoints.
4. Trocar `new MockPoseDetector()` por `new MediaPipePoseDetector()` em
   `ExecutionScreen.tsx` (uma linha).
5. Substituir o laço `setInterval` pelo mecanismo real de captura
   (frame processor ou `takePictureAsync`), conforme seção 4.
6. Testar em dispositivo físico de baixo desempenho — medir uso de
   memória/CPU e taxa de quadros, ajustando `SAMPLE_INTERVAL_MS` e a
   resolução de captura conforme necessário.
7. Validar o score resultante contra execuções conhecidas (correta vs.
   incorreta) para calibrar `MAX_TOLERATED_ANGLE_DIFF_DEGREES` em
   [poseScoring.ts](poseScoring.ts).

## 7. Cuidados de supply-chain ao instalar (reforço)

> ⚠️ Bibliotecas de visão computacional/ML trazem builds nativos e
> binários pré-compilados — superfície maior que pacotes JS comuns.

- Instalar só de registros oficiais (npmjs.com), conferindo o nome exato
  do pacote (ex.: `react-native-fast-tflite`, não variações).
- Conferir o publisher/organização do pacote e o repositório-fonte (ex.:
  GitHub oficial do mantenedor) antes de adicionar.
- Baixar modelos `.tflite`/`.task` apenas de fontes oficiais (TensorFlow
  Hub, Google AI Edge, MediaPipe), conferindo checksums quando
  disponíveis — modelos maliciosos são um vetor de ataque menos óbvio,
  mas real.
- Revisar o lockfile gerado e rodar `npm audit`/`pip-audit` conforme
  aplicável antes de buildar para dispositivos reais.
