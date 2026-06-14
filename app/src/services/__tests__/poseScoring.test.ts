import { computeAsymmetry, extractJointAngles, scoreExecution } from '../poseScoring';
import { LANDMARK_INDEX, Landmark, PoseFrame } from '../poseTypes';

/**
 * Cria um frame com todos os landmarks numa posição neutra e permite
 * sobrescrever pontos específicos — facilita montar poses sintéticas
 * com ângulos articulares conhecidos para validar o scoring.
 */
function makeFrame(timestampMs: number, overrides: Partial<Record<number, Landmark>> = {}): PoseFrame {
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  for (const [index, landmark] of Object.entries(overrides)) {
    if (landmark) landmarks[Number(index)] = landmark;
  }
  return { timestampMs, landmarks };
}

/**
 * Monta um frame com o cotovelo esquerdo num ângulo articular determinado
 * (graus). O ombro fica fixo acima do cotovelo (vetor cotovelo→ombro =
 * (0, -0.5)); o pulso é posicionado girando esse vetor por `angleDegrees`,
 * de forma que o ângulo entre cotovelo→ombro e cotovelo→pulso (o que
 * `angleBetween`/`extractJointAngles` mede) seja exatamente `angleDegrees`
 * — 0° = totalmente flexionado (pulso encosta no ombro), 180° = braço
 * estendido (ombro/cotovelo/pulso colineares).
 */
function frameWithLeftElbowAngle(timestampMs: number, angleDegrees: number): PoseFrame {
  const radians = (angleDegrees * Math.PI) / 180;
  return makeFrame(timestampMs, {
    [LANDMARK_INDEX.leftShoulder]: { x: 0.5, y: 0.0, visibility: 1 },
    [LANDMARK_INDEX.leftElbow]: { x: 0.5, y: 0.5, visibility: 1 },
    [LANDMARK_INDEX.leftWrist]: {
      x: 0.5 + Math.sin(radians) * 0.5,
      y: 0.5 - Math.cos(radians) * 0.5,
      visibility: 1,
    },
  });
}

/**
 * Monta um frame com os joelhos esquerdo e direito em ângulos articulares
 * independentes (graus), seguindo a mesma construção geométrica de
 * `frameWithLeftElbowAngle` (quadril fixo acima do joelho; tornozelo
 * posicionado para que o ângulo quadril→joelho→tornozelo seja exatamente
 * o ângulo informado). Demais articulações ficam na posição neutra (0°),
 * o que mantém cotovelos e quadris simétricos entre os lados.
 */
function frameWithKneeAngles(timestampMs: number, leftAngleDegrees: number, rightAngleDegrees: number): PoseFrame {
  const toAnkle = (angleDegrees: number) => {
    const radians = (angleDegrees * Math.PI) / 180;
    return { x: 0.5 + Math.sin(radians) * 0.5, y: 0.5 - Math.cos(radians) * 0.5, visibility: 1 };
  };
  return makeFrame(timestampMs, {
    [LANDMARK_INDEX.leftHip]: { x: 0.5, y: 0.0, visibility: 1 },
    [LANDMARK_INDEX.leftKnee]: { x: 0.5, y: 0.5, visibility: 1 },
    [LANDMARK_INDEX.leftAnkle]: toAnkle(leftAngleDegrees),
    [LANDMARK_INDEX.rightHip]: { x: 0.5, y: 0.0, visibility: 1 },
    [LANDMARK_INDEX.rightKnee]: { x: 0.5, y: 0.5, visibility: 1 },
    [LANDMARK_INDEX.rightAnkle]: toAnkle(rightAngleDegrees),
  });
}

describe('extractJointAngles', () => {
  it('calcula ~90 graus para um cotovelo dobrado em ângulo reto', () => {
    const frame = frameWithLeftElbowAngle(0, 90);

    const angles = extractJointAngles(frame);

    expect(angles.leftElbow).toBeCloseTo(90, 0);
  });

  it('calcula ~180 graus para um braço estendido', () => {
    const frame = frameWithLeftElbowAngle(0, 180);

    const angles = extractJointAngles(frame);

    expect(angles.leftElbow).toBeCloseTo(180, 0);
  });
});

describe('scoreExecution', () => {
  it('retorna score próximo de 100 quando a execução é idêntica à referência', () => {
    const sequence = [frameWithLeftElbowAngle(0, 90), frameWithLeftElbowAngle(100, 120), frameWithLeftElbowAngle(200, 150)];

    const score = scoreExecution(sequence, sequence);

    expect(score).toBeGreaterThanOrEqual(95);
  });

  it('retorna score baixo quando a execução diverge muito da referência', () => {
    const reference = [frameWithLeftElbowAngle(0, 90), frameWithLeftElbowAngle(100, 90), frameWithLeftElbowAngle(200, 90)];
    const userExecution = [frameWithLeftElbowAngle(0, 180), frameWithLeftElbowAngle(100, 180), frameWithLeftElbowAngle(200, 180)];

    const score = scoreExecution(userExecution, reference);

    expect(score).toBeLessThan(40);
  });

  it('tolera diferenças de ritmo entre as sequências (alinhamento por DTW)', () => {
    const reference = [frameWithLeftElbowAngle(0, 90), frameWithLeftElbowAngle(100, 120), frameWithLeftElbowAngle(200, 150)];
    // Mesma trajetória de ângulos, mas amostrada em ritmo mais lento (frames repetidos)
    const slowerExecution = [
      frameWithLeftElbowAngle(0, 90),
      frameWithLeftElbowAngle(50, 90),
      frameWithLeftElbowAngle(100, 120),
      frameWithLeftElbowAngle(150, 120),
      frameWithLeftElbowAngle(200, 150),
      frameWithLeftElbowAngle(250, 150),
    ];

    const score = scoreExecution(slowerExecution, reference);

    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('retorna 0 quando uma das sequências está vazia', () => {
    const sequence = [frameWithLeftElbowAngle(0, 90)];

    expect(scoreExecution([], sequence)).toBe(0);
    expect(scoreExecution(sequence, [])).toBe(0);
  });
});

describe('computeAsymmetry', () => {
  it('retorna null para uma sequência vazia', () => {
    expect(computeAsymmetry([])).toBeNull();
  });

  it('retorna 0% em todas as articulações para uma execução simétrica', () => {
    const frames = [frameWithKneeAngles(0, 90, 90), frameWithKneeAngles(100, 120, 120)];

    const result = computeAsymmetry(frames);

    expect(result).toEqual({ overallPercent: 0, byJoint: { elbow: 0, knee: 0, hip: 0 } });
  });

  it('detecta diferença percentual entre os joelhos quando um lado dobra muito mais que o outro', () => {
    const frames = [frameWithKneeAngles(0, 90, 0)];

    const result = computeAsymmetry(frames);

    expect(result?.byJoint.knee).toBe(100);
    expect(result?.byJoint.elbow).toBe(0);
    expect(result?.byJoint.hip).toBe(0);
    expect(result?.overallPercent).toBe(Math.round(100 / 3));
  });
});
