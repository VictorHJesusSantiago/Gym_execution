import { Landmark, LANDMARK_INDEX, PoseFrame } from './poseTypes';

/**
 * Algoritmo de comparação de execução de exercício (README.md seção 4):
 * compara os ângulos articulares do usuário com uma sequência de referência
 * via DTW (Dynamic Time Warping) e gera uma porcentagem de acerto.
 *
 * Otimizações de memória/performance:
 * - DTW com banda de Sakoe-Chiba: O(n×W) em vez de O(n×m), eliminando o
 *   risco de OOM em sessões longas (até 6000 frames × referência).
 * - Rolling two-row array: O(m) de espaço em vez de O(n×m).
 * - Downsampling: frames do usuário limitados a 3× a referência antes do DTW.
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

/**
 * Ângulos da sequência de referência, memoizados por identidade do array.
 *
 * `getRealtimeFeedback` roda a cada frame capturado (~10/s) e recalculava os
 * ângulos de TODA a referência toda vez: com ~100 frames de referência são
 * ~6.000 `acos`/`hypot` por segundo jogados fora, no mesmo aparelho de 2GB de
 * RAM que precisa rodar a inferência do MoveNet no mesmo intervalo (RNF01).
 * A referência é imutável durante a série, então basta calcular uma vez.
 *
 * WeakMap e não Map: a entrada morre junto com o array de referência, sem
 * segurar frames de exercícios já encerrados na memória.
 */
const referenceAngleCache = new WeakMap<PoseFrame[], JointAngles[]>();

function anglesForReference(referenceFrames: PoseFrame[]): JointAngles[] {
  const cached = referenceAngleCache.get(referenceFrames);
  if (cached) return cached;

  const angles = referenceFrames.map(extractJointAngles);
  referenceAngleCache.set(referenceFrames, angles);
  return angles;
}

export function angleVectorDistance(a: JointAngles, b: JointAngles): number {
  const keys = Object.keys(a) as (keyof JointAngles)[];
  const sumSquared = keys.reduce((acc, key) => acc + (a[key] - b[key]) ** 2, 0);
  return Math.sqrt(sumSquared / keys.length);
}

/** Reamostragagem uniforme: reduz `seq` para `targetLength` elementos. */
function downsample<T>(seq: T[], targetLength: number): T[] {
  if (seq.length <= targetLength) return seq;
  const step = (seq.length - 1) / (targetLength - 1);
  return Array.from({ length: targetLength }, (_, i) => seq[Math.round(i * step)]);
}

/**
 * DTW com banda de Sakoe-Chiba e rolling two-row array.
 *
 * Complexidade: O(n × W) tempo, O(m) espaço — vs. O(n×m) da implementação
 * full-matrix. Com W=50 e m=100 frames de referência:
 *   antes: 6001 × 101 × 8B ≈ 4.8MB por chamada
 *   depois: 2 × 101 × 8B ≈ 1.6KB por chamada
 */
function dtwBanded(userSeq: JointAngles[], refSeq: JointAngles[], bandWidth: number): number {
  const n = userSeq.length;
  const m = refSeq.length;
  // W deve ser pelo menos |n-m| para garantir que exista um caminho válido.
  const W = Math.max(bandWidth, Math.abs(n - m));
  const INF = Infinity;

  let prev = new Float64Array(m + 1).fill(INF);
  let curr = new Float64Array(m + 1).fill(INF);
  prev[0] = 0;

  for (let i = 1; i <= n; i++) {
    curr.fill(INF);
    const jMin = Math.max(1, i - W);
    const jMax = Math.min(m, i + W);
    for (let j = jMin; j <= jMax; j++) {
      const d = angleVectorDistance(userSeq[i - 1], refSeq[j - 1]);
      const best = Math.min(prev[j - 1], prev[j], curr[j - 1]);
      curr[j] = d + best;
    }
    // Troca os buffers sem alocação nova
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[m] / Math.max(n, m);
}

function dtwAverageDistance(userSeq: JointAngles[], referenceSeq: JointAngles[]): number {
  const n = userSeq.length;
  const m = referenceSeq.length;
  if (n === 0 || m === 0) return Infinity;

  // Limita os frames do usuário a 3× a referência antes do DTW — evita
  // matrizes de custo gigantes em sessões longas (ex.: 6000 × 100 frames).
  const maxFrames = m * 3;
  const normalizedUser = n > maxFrames ? downsample(userSeq, maxFrames) : userSeq;

  return dtwBanded(normalizedUser, referenceSeq, 50);
}

const MAX_TOLERATED_ANGLE_DIFF_DEGREES = 45;

export function scoreExecution(userFrames: PoseFrame[], referenceFrames: PoseFrame[]): number {
  const userAngles = userFrames.map(extractJointAngles);
  const referenceAngles = referenceFrames.map(extractJointAngles);

  const avgDistance = dtwAverageDistance(userAngles, referenceAngles);
  if (!Number.isFinite(avgDistance)) return 0;

  const normalized = Math.min(1, avgDistance / MAX_TOLERATED_ANGLE_DIFF_DEGREES);
  const score = (1 - normalized) * 100;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export type AsymmetricJoint = 'elbow' | 'knee' | 'hip';

const ASYMMETRY_PAIRS: Record<AsymmetricJoint, [keyof JointAngles, keyof JointAngles]> = {
  elbow: ['leftElbow', 'rightElbow'],
  knee: ['leftKnee', 'rightKnee'],
  hip: ['leftHip', 'rightHip'],
};

export const ASYMMETRY_THRESHOLD_PERCENT = 15;

export type AsymmetryResult = {
  overallPercent: number;
  byJoint: Record<AsymmetricJoint, number>;
};

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

const MIN_MOTION_RANGE_DEGREES = 10;
const REP_HYSTERESIS_PERCENT = 0.15;

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

export function countRepetitions(frames: PoseFrame[]): number {
  return segmentRepetitions(frames).length;
}

export const FATIGUE_CONSISTENCY_THRESHOLD_PERCENT = 70;

export type FatigueResult = {
  repCount: number;
  consistencyPercent: number;
  degraded: boolean;
};

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

const REALTIME_FEEDBACK_THRESHOLD_DEGREES = 20;

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

export function getRealtimeFeedback(frame: PoseFrame, referenceFrames: PoseFrame[]): RealtimeFeedback | null {
  if (referenceFrames.length === 0) return null;

  const current = extractJointAngles(frame);
  const referenceAngles = anglesForReference(referenceFrames);

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
