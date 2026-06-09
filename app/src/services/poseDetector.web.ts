import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { CameraFrameInput, Landmark, PoseDetector, PoseFrame } from './poseTypes';

/**
 * Implementação web do `PoseDetector` usando `@mediapipe/tasks-vision`
 * (WASM), conforme README.md ("Stack" / detector web). O WASM runtime é
 * carregado do jsDelivr na MESMA versão fixada em package.json
 * (`@mediapipe/tasks-vision`), e o modelo `pose_landmarker_lite` vem do
 * bucket oficial de modelos do Google (`storage.googleapis.com/mediapipe-models`)
 * — ambas fontes oficiais do projeto MediaPipe.
 */
const TASKS_VISION_VERSION = '0.10.35';
const WASM_BASE_PATH = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

export class PlatformPoseDetector implements PoseDetector {
  private landmarker: PoseLandmarker | null = null;

  async load(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
    this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_ASSET_PATH,
        delegate: 'GPU',
      },
      runningMode: 'IMAGE',
      numPoses: 1,
    });
  }

  /**
   * `frame.uri` vem de `expo-camera`'s `takePictureAsync` — na web, uma
   * string base64 (ou já um data URI). Carregamos como `<img>` e rodamos
   * detecção em modo `IMAGE` (uma foto por vez, sem vídeo contínuo).
   */
  async detect(timestampMs: number, frame?: CameraFrameInput): Promise<PoseFrame | null> {
    if (!this.landmarker || !frame) return null;

    const image = await loadImageElement(frame.uri);
    const result = this.landmarker.detect(image);
    const landmarks = result.landmarks[0];
    if (!landmarks) return null;

    return { timestampMs, landmarks: landmarks.map(toLandmark) };
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}

function toLandmark(landmark: { x: number; y: number; visibility: number }): Landmark {
  return { x: landmark.x, y: landmark.y, visibility: landmark.visibility };
}

function loadImageElement(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Falha ao carregar a imagem capturada para detecção de pose.'));
    image.src = uri.startsWith('data:') ? uri : `data:image/jpeg;base64,${uri}`;
  });
}
