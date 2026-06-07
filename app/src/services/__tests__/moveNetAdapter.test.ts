import { COCO_KEYPOINT_INDEX, moveNetToMediaPipeFrame } from '../moveNetAdapter';
import { LANDMARK_INDEX } from '../poseTypes';
import { extractJointAngles } from '../poseScoring';

/** Monta os 17 keypoints COCO com uma posição neutra, permitindo overrides pontuais. */
function makeCocoKeypoints(
  overrides: Partial<Record<number, { x: number; y: number; score?: number }>> = {}
): { x: number; y: number; score?: number }[] {
  const keypoints: { x: number; y: number; score?: number }[] = Array.from({ length: 17 }, () => ({
    x: 0.5,
    y: 0.5,
    score: 1,
  }));
  for (const [index, keypoint] of Object.entries(overrides)) {
    if (keypoint) keypoints[Number(index)] = keypoint;
  }
  return keypoints;
}

describe('moveNetToMediaPipeFrame', () => {
  it('produz um frame com 33 landmarks (formato MediaPipe)', () => {
    const frame = moveNetToMediaPipeFrame(0, makeCocoKeypoints());

    expect(frame.timestampMs).toBe(0);
    expect(frame.landmarks).toHaveLength(33);
  });

  it('mapeia cada articulação de LANDMARK_INDEX para o índice MediaPipe correto', () => {
    const keypoints = makeCocoKeypoints({
      [COCO_KEYPOINT_INDEX.leftShoulder]: { x: 0.1, y: 0.2, score: 0.9 },
      [COCO_KEYPOINT_INDEX.rightWrist]: { x: 0.7, y: 0.8, score: 0.6 },
      [COCO_KEYPOINT_INDEX.leftAnkle]: { x: 0.3, y: 0.4, score: 0.5 },
    });

    const frame = moveNetToMediaPipeFrame(123, keypoints);

    expect(frame.landmarks[LANDMARK_INDEX.leftShoulder]).toEqual({ x: 0.1, y: 0.2, visibility: 0.9 });
    expect(frame.landmarks[LANDMARK_INDEX.rightWrist]).toEqual({ x: 0.7, y: 0.8, visibility: 0.6 });
    expect(frame.landmarks[LANDMARK_INDEX.leftAnkle]).toEqual({ x: 0.3, y: 0.4, visibility: 0.5 });
  });

  it('preenche com placeholder de visibilidade zero os landmarks sem equivalente no COCO', () => {
    const frame = moveNetToMediaPipeFrame(0, makeCocoKeypoints());

    // Índice 17 (left_pinky) não existe no COCO/MoveNet.
    expect(frame.landmarks[17]).toEqual({ x: 0, y: 0, visibility: 0 });
  });

  it('assume visibilidade 1 quando o keypoint não traz `score`', () => {
    const keypoints = makeCocoKeypoints({
      [COCO_KEYPOINT_INDEX.nose]: { x: 0.5, y: 0.1 },
    });

    const frame = moveNetToMediaPipeFrame(0, keypoints);

    expect(frame.landmarks[0].visibility).toBe(1);
  });

  it('gera frames compatíveis com extractJointAngles (mesmo cálculo de ângulo do detector simulado)', () => {
    // Cotovelo esquerdo dobrado a 90°: ombro acima do cotovelo, punho ao lado.
    const keypoints = makeCocoKeypoints({
      [COCO_KEYPOINT_INDEX.leftShoulder]: { x: 0.5, y: 0.0 },
      [COCO_KEYPOINT_INDEX.leftElbow]: { x: 0.5, y: 0.5 },
      [COCO_KEYPOINT_INDEX.leftWrist]: { x: 1.0, y: 0.5 },
    });

    const frame = moveNetToMediaPipeFrame(0, keypoints);
    const angles = extractJointAngles(frame);

    expect(angles.leftElbow).toBeCloseTo(90, 0);
  });
});
