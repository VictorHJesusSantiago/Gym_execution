/**
 * Tipos comuns de pose corporal, alinhados ao formato de saída do
 * MediaPipe Pose (33 landmarks). Mantidos independentes da lib escolhida
 * para que o detector real possa ser trocado sem afetar o resto do app.
 */

export type Landmark = {
  x: number; // normalizado [0, 1]
  y: number; // normalizado [0, 1]
  visibility?: number; // confiança [0, 1]
};

export type PoseFrame = {
  timestampMs: number;
  landmarks: Landmark[]; // índice segue o padrão MediaPipe Pose (33 pontos)
};

/** Principais articulações usadas no scoring, por índice MediaPipe. */
export const LANDMARK_INDEX = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

/**
 * Foto capturada da câmera (`expo-camera`'s `takePictureAsync`), repassada
 * ao detector para inferência. Em iOS/Android `uri` é um caminho de
 * arquivo local; na web é uma string base64 (usável como `src` de uma
 * `<img>`/`HTMLImageElement`).
 */
export type CameraFrameInput = {
  uri: string;
  width: number;
  height: number;
};

/**
 * Contrato que qualquer detector de pose deve cumprir.
 * A implementação concreta (ex: MediaPipe Pose via TFLite) entra depois,
 * sem alterar quem consome esta interface.
 */
export interface PoseDetector {
  /** Inicializa o modelo (carrega pesos quantizados, aloca buffers). */
  load(): Promise<void>;
  /** Processa um frame de câmera e retorna os landmarks detectados. */
  detect(frameTimestampMs: number, frame?: CameraFrameInput): Promise<PoseFrame | null>;
  /** Libera recursos do modelo. */
  dispose(): void;
}
