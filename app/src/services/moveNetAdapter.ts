import { Landmark, PoseFrame } from './poseTypes';

/**
 * Adaptador MoveNet (formato COCO, 17 keypoints) → MediaPipe Pose (33
 * landmarks), conforme a "segunda opção" descrita em
 * README.md ("Módulo de visão computacional") seção "Atenção ao mapeamento
 * de keypoints": concentrar a tradução em um único ponto, preservando
 * `poseScoring.ts`/`LANDMARK_INDEX` (que seguem o índice MediaPipe) sem
 * qualquer alteração — qualquer detector baseado em MoveNet (ex.:
 * MoveNet Lightning INT8, recomendado para o hardware-alvo) passa por
 * aqui antes de virar um `PoseFrame`.
 */

/** Índice de cada keypoint na saída padrão do MoveNet (ordem COCO). */
export const COCO_KEYPOINT_INDEX = {
  nose: 0,
  leftEye: 1,
  rightEye: 2,
  leftEar: 3,
  rightEar: 4,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16,
} as const;

const MEDIAPIPE_LANDMARK_COUNT = 33;

/**
 * Mapeia cada um dos 17 índices COCO para o índice MediaPipe equivalente.
 * Os 16 landmarks do MediaPipe sem correspondência no COCO (dedos,
 * calcanhares, pontos extras de olho/boca) ficam com um placeholder de
 * visibilidade zero — `extractJointAngles`/`scoreExecution` não os usam
 * (ver `LANDMARK_INDEX` em poseTypes.ts, que cobre só as 12 articulações
 * de interesse, todas presentes no COCO).
 */
const COCO_TO_MEDIAPIPE_INDEX: Record<number, number> = {
  [COCO_KEYPOINT_INDEX.nose]: 0,
  [COCO_KEYPOINT_INDEX.leftEye]: 2,
  [COCO_KEYPOINT_INDEX.rightEye]: 5,
  [COCO_KEYPOINT_INDEX.leftEar]: 7,
  [COCO_KEYPOINT_INDEX.rightEar]: 8,
  [COCO_KEYPOINT_INDEX.leftShoulder]: 11,
  [COCO_KEYPOINT_INDEX.rightShoulder]: 12,
  [COCO_KEYPOINT_INDEX.leftElbow]: 13,
  [COCO_KEYPOINT_INDEX.rightElbow]: 14,
  [COCO_KEYPOINT_INDEX.leftWrist]: 15,
  [COCO_KEYPOINT_INDEX.rightWrist]: 16,
  [COCO_KEYPOINT_INDEX.leftHip]: 23,
  [COCO_KEYPOINT_INDEX.rightHip]: 24,
  [COCO_KEYPOINT_INDEX.leftKnee]: 25,
  [COCO_KEYPOINT_INDEX.rightKnee]: 26,
  [COCO_KEYPOINT_INDEX.leftAnkle]: 27,
  [COCO_KEYPOINT_INDEX.rightAnkle]: 28,
};

function placeholderLandmark(): Landmark {
  return { x: 0, y: 0, visibility: 0 };
}

/**
 * Converte os 17 keypoints brutos do MoveNet (na ordem COCO, cada um
 * `{ x, y, score }` normalizado) para um `PoseFrame` no formato MediaPipe
 * de 33 landmarks, pronto para `scoreExecution`/`extractJointAngles`.
 *
 * `keypoints[i]` deve corresponder ao índice `i` de `COCO_KEYPOINT_INDEX`
 * — é o formato em que `react-native-fast-tflite`/MoveNet retornam a
 * saída do modelo (ver poseDetector.ts).
 */
export function moveNetToMediaPipeFrame(
  timestampMs: number,
  keypoints: ReadonlyArray<{ x: number; y: number; score?: number }>
): PoseFrame {
  const landmarks: Landmark[] = Array.from({ length: MEDIAPIPE_LANDMARK_COUNT }, placeholderLandmark);

  for (const [cocoIndexKey, mediaPipeIndex] of Object.entries(COCO_TO_MEDIAPIPE_INDEX)) {
    const keypoint = keypoints[Number(cocoIndexKey)];
    if (keypoint === undefined) continue;

    landmarks[mediaPipeIndex] = { x: keypoint.x, y: keypoint.y, visibility: keypoint.score ?? 1 };
  }

  return { timestampMs, landmarks };
}
