import { Landmark, LANDMARK_INDEX, PoseFrame } from './poseTypes';

/**
 * Algoritmo de comparação de execução de exercício, descrito em
 * README.md (seção 4): compara o ângulo das principais articulações
 * do usuário, quadro a quadro, com uma sequência de referência, e gera
 * uma porcentagem de acerto. Roda 100% no dispositivo (sem enviar vídeo).
 *
 * Estratégia:
 *  1. Reduzir cada pose a um conjunto de ângulos articulares (invariantes
 *     a posição/escala na tela — robusto a diferenças de enquadramento).
 *  2. Alinhar a sequência do usuário à referência no tempo (DTW simplificado),
 *     pois pessoas executam o mesmo movimento em ritmos diferentes.
 *  3. Calcular a diferença angular média após o alinhamento e converter
 *     em uma porcentagem de similaridade.
 */

export type JointAngles = {
  leftElbow: number;
  rightElbow: number;
  leftKnee: number;
  rightKnee: number;
  leftHip: number;
  rightHip: number;
};

const ANGLE_TRIPLETS: Record<keyof JointAngles, [number, number, number]> = {
  leftElbow: [LANDMARK_INDEX.leftShoulder, LANDMARK_INDEX.leftElbow, LANDMARK_INDEX.leftWrist],
  rightElbow: [LANDMARK_INDEX.rightShoulder, LANDMARK_INDEX.rightElbow, LANDMARK_INDEX.rightWrist],
  leftKnee: [LANDMARK_INDEX.leftHip, LANDMARK_INDEX.leftKnee, LANDMARK_INDEX.leftAnkle],
  rightKnee: [LANDMARK_INDEX.rightHip, LANDMARK_INDEX.rightKnee, LANDMARK_INDEX.rightAnkle],
  leftHip: [LANDMARK_INDEX.leftShoulder, LANDMARK_INDEX.leftHip, LANDMARK_INDEX.leftKnee],
  rightHip: [LANDMARK_INDEX.rightShoulder, LANDMARK_INDEX.rightHip, LANDMARK_INDEX.rightKnee],
};

/** Ângulo em graus formado em `b` pelos segmentos b→a e b→c. */
function angleBetween(a: Landmark, b: Landmark, c: Landmark): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function extractJointAngles(frame: PoseFrame): JointAngles {
  const result = {} as JointAngles;
  for (const key of Object.keys(ANGLE_TRIPLETS) as (keyof JointAngles)[]) {
    const [ai, bi, ci] = ANGLE_TRIPLETS[key];
    const a = frame.landmarks[ai];
    const b = frame.landmarks[bi];
    const c = frame.landmarks[ci];
    result[key] = a && b && c ? angleBetween(a, b, c) : 0;
  }
  return result;
}

function angleVectorDistance(a: JointAngles, b: JointAngles): number {
  const keys = Object.keys(a) as (keyof JointAngles)[];
  const sumSquared = keys.reduce((acc, key) => acc + (a[key] - b[key]) ** 2, 0);
  return Math.sqrt(sumSquared / keys.length);
}

/**
 * Alinha duas sequências por Dynamic Time Warping e retorna a distância
 * média acumulada no melhor caminho — tolera variações de ritmo/velocidade
 * entre a execução do usuário e a referência.
 */
function dtwAverageDistance(userSeq: JointAngles[], referenceSeq: JointAngles[]): number {
  const n = userSeq.length;
  const m = referenceSeq.length;
  if (n === 0 || m === 0) return Infinity;

  const cost: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
  cost[0][0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const d = angleVectorDistance(userSeq[i - 1], referenceSeq[j - 1]);
      cost[i][j] = d + Math.min(cost[i - 1][j], cost[i][j - 1], cost[i - 1][j - 1]);
    }
  }

  // Normaliza pelo comprimento do caminho (aprox. pela maior sequência)
  return cost[n][m] / Math.max(n, m);
}

/** Diferença angular (graus) acima da qual consideramos "erro total" (0%). */
const MAX_TOLERATED_ANGLE_DIFF_DEGREES = 45;

/**
 * Converte a distância angular média (após alinhamento DTW) em uma
 * porcentagem de 0 a 100. Quanto menor a distância, maior o score.
 */
export function scoreExecution(userFrames: PoseFrame[], referenceFrames: PoseFrame[]): number {
  const userAngles = userFrames.map(extractJointAngles);
  const referenceAngles = referenceFrames.map(extractJointAngles);

  const avgDistance = dtwAverageDistance(userAngles, referenceAngles);
  if (!Number.isFinite(avgDistance)) return 0;

  const normalized = Math.min(1, avgDistance / MAX_TOLERATED_ANGLE_DIFF_DEGREES);
  const score = (1 - normalized) * 100;
  return Math.round(Math.max(0, Math.min(100, score)));
}
