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

export function angleVectorDistance(a: JointAngles, b: JointAngles): number {
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

/** Articulações em pares esquerda/direita usadas na detecção de assimetria. */
export type AsymmetricJoint = 'elbow' | 'knee' | 'hip';

const ASYMMETRY_PAIRS: Record<AsymmetricJoint, [keyof JointAngles, keyof JointAngles]> = {
  elbow: ['leftElbow', 'rightElbow'],
  knee: ['leftKnee', 'rightKnee'],
  hip: ['leftHip', 'rightHip'],
};

/**
 * Diferença percentual acima da qual sinalizamos uma possível compensação
 * (ex.: um joelho dobrando bem mais que o outro no agachamento).
 */
export const ASYMMETRY_THRESHOLD_PERCENT = 15;

export type AsymmetryResult = {
  /** Diferença percentual média entre os lados, considerando as 3 articulações. */
  overallPercent: number;
  /** Diferença percentual por articulação (cotovelo, joelho, quadril). */
  byJoint: Record<AsymmetricJoint, number>;
};

/**
 * Compara o ângulo médio de cada articulação entre o lado esquerdo e o
 * direito ao longo da execução — grandes diferenças sugerem compensação
 * (ex.: descarregar o peso mais num lado do corpo). Roda sobre os mesmos
 * frames já capturados para o `scoreExecution`, sem custo adicional de CV.
 */
export function computeAsymmetry(frames: PoseFrame[]): AsymmetryResult | null {
  if (frames.length === 0) return null;

  const angles = frames.map(extractJointAngles);
  const average = (key: keyof JointAngles): number =>
    angles.reduce((sum, frame) => sum + frame[key], 0) / angles.length;

  const byJoint = {} as Record<AsymmetricJoint, number>;
  for (const [joint, [leftKey, rightKey]] of Object.entries(ASYMMETRY_PAIRS) as Array<
    [AsymmetricJoint, [keyof JointAngles, keyof JointAngles]]
  >) {
    const left = average(leftKey);
    const right = average(rightKey);
    const base = Math.max(left, right, 1);
    byJoint[joint] = Math.round((Math.abs(left - right) / base) * 100);
  }

  const overallPercent = Math.round(
    (byJoint.elbow + byJoint.knee + byJoint.hip) / Object.keys(byJoint).length
  );

  return { overallPercent, byJoint };
}

/**
 * Diferença minima (graus) entre o maior e o menor valor de uma articulação
 * ao longo da execução para considerá-la o "sinal primário" do movimento —
 * abaixo disso, tratamos como ruído/parado e não segmentamos repetições.
 */
const MIN_MOTION_RANGE_DEGREES = 10;

/**
 * Margem (em % da amplitude do sinal primário) usada como histerese para
 * decidir quando o usuário "saiu" da posição alta/baixa do movimento —
 * evita contar tremulações perto do meio do percurso como repetições.
 */
const REP_HYSTERESIS_PERCENT = 0.15;

/**
 * Divide os frames capturados em uma repetição por ciclo completo
 * (alto → baixo → alto) da articulação com maior amplitude de movimento
 * (ex.: joelho no agachamento, cotovelo na flexão). Frames de um ciclo
 * incompleto no final são descartados.
 */
function segmentRepetitions(frames: PoseFrame[]): PoseFrame[][] {
  if (frames.length === 0) return [];

  const angles = frames.map(extractJointAngles);
  const keys = Object.keys(angles[0]) as (keyof JointAngles)[];

  let signal: number[] | null = null;
  let bestRange = MIN_MOTION_RANGE_DEGREES;
  for (const key of keys) {
    const values = angles.map((a) => a[key]);
    const range = Math.max(...values) - Math.min(...values);
    if (range > bestRange) {
      bestRange = range;
      signal = values;
    }
  }
  if (!signal) return [];

  const min = Math.min(...signal);
  const max = Math.max(...signal);
  const mid = (min + max) / 2;
  const margin = (max - min) * REP_HYSTERESIS_PERCENT;

  const segments: PoseFrame[][] = [];
  let current: PoseFrame[] = [];
  let state: 'high' | 'low' = 'high';

  for (let i = 0; i < frames.length; i++) {
    current.push(frames[i]);
    const value = signal[i];
    if (state === 'high' && value < mid - margin) {
      state = 'low';
    } else if (state === 'low' && value > mid + margin) {
      segments.push(current);
      current = [];
      state = 'high';
    }
  }

  return segments;
}

/**
 * Conta repetições automaticamente a partir da oscilação da articulação que
 * mais se move durante a execução (sem precisar de configuração por
 * exercício).
 */
export function countRepetitions(frames: PoseFrame[]): number {
  return segmentRepetitions(frames).length;
}

/**
 * Abaixo desse percentual de similaridade entre a última e a primeira
 * repetição, consideramos que a forma "degradou" ao longo da série
 * (possível sinal de fadiga).
 */
export const FATIGUE_CONSISTENCY_THRESHOLD_PERCENT = 70;

export type FatigueResult = {
  /** Repetições completas detectadas. */
  repCount: number;
  /** O quão parecida a última repetição é da primeira (0-100). */
  consistencyPercent: number;
  /** `true` quando a forma da última repetição mudou significativamente em relação à primeira. */
  degraded: boolean;
};

/**
 * Compara a última repetição com a primeira usando o mesmo algoritmo de
 * `scoreExecution` (a primeira repetição serve de "referência") — uma queda
 * grande de similaridade sugere que a forma piorou ao longo da série,
 * possível indício de fadiga. Retorna `null` se menos de 2 repetições
 * completas foram detectadas.
 */
export function detectFatigue(frames: PoseFrame[]): FatigueResult | null {
  const segments = segmentRepetitions(frames);
  if (segments.length < 2) return null;

  const consistencyPercent = scoreExecution(segments[segments.length - 1], segments[0]);

  return {
    repCount: segments.length,
    consistencyPercent,
    degraded: consistencyPercent < FATIGUE_CONSISTENCY_THRESHOLD_PERCENT,
  };
}

/** Diferença (graus) acima da qual avisamos sobre uma articulação durante a execução. */
const REALTIME_FEEDBACK_THRESHOLD_DEGREES = 20;

/** Dica curta exibida (e usada para acionar vibração) por articulação. */
const JOINT_FEEDBACK_MESSAGES: Record<keyof JointAngles, string> = {
  leftElbow: 'Ajuste o cotovelo esquerdo',
  rightElbow: 'Ajuste o cotovelo direito',
  leftKnee: 'Ajuste o joelho esquerdo',
  rightKnee: 'Ajuste o joelho direito',
  leftHip: 'Ajuste o quadril esquerdo',
  rightHip: 'Ajuste o quadril direito',
};

export type RealtimeFeedback = {
  joint: keyof JointAngles;
  message: string;
};

/**
 * Compara o frame atual com o frame de referência mais parecido (menor
 * distância angular) e retorna uma dica curta para a articulação que mais
 * diverge — usado para feedback em tempo real durante a execução (ver
 * README.md seção 4). Retorna `null` quando não há referência ou quando o
 * usuário está dentro da tolerância em todas as articulações.
 */
export function getRealtimeFeedback(frame: PoseFrame, referenceFrames: PoseFrame[]): RealtimeFeedback | null {
  if (referenceFrames.length === 0) return null;

  const current = extractJointAngles(frame);
  const referenceAngles = referenceFrames.map(extractJointAngles);

  let closest = referenceAngles[0];
  let closestDistance = angleVectorDistance(current, closest);
  for (let i = 1; i < referenceAngles.length; i++) {
    const distance = angleVectorDistance(current, referenceAngles[i]);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = referenceAngles[i];
    }
  }

  let worstJoint: keyof JointAngles | null = null;
  let worstDiff = REALTIME_FEEDBACK_THRESHOLD_DEGREES;
  for (const key of Object.keys(current) as (keyof JointAngles)[]) {
    const diff = Math.abs(current[key] - closest[key]);
    if (diff > worstDiff) {
      worstDiff = diff;
      worstJoint = key;
    }
  }

  return worstJoint ? { joint: worstJoint, message: JOINT_FEEDBACK_MESSAGES[worstJoint] } : null;
}
