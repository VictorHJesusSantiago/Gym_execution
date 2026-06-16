import { computePersonalRecord, detectNewRecords, detectOverload } from '../sessionInsights';
import type { TrainingSessionPublic } from '../sessionsService';

function makeSession(overrides: Partial<TrainingSessionPublic> = {}): TrainingSessionPublic {
  return {
    id: 'session-1',
    exercise_id: 'squat',
    score: 80,
    executed_at: '2026-01-01T10:00:00.000Z',
    weight_kg: 50,
    ...overrides,
  };
}

describe('computePersonalRecord', () => {
  it('retorna null quando não há sessões do exercício', () => {
    expect(computePersonalRecord([], 'squat')).toBeNull();
    expect(computePersonalRecord([makeSession({ exercise_id: 'bench' })], 'squat')).toBeNull();
  });

  it('retorna o maior score e a maior carga entre as sessões do exercício', () => {
    const sessions = [
      makeSession({ score: 70, weight_kg: 40 }),
      makeSession({ score: 90, weight_kg: 60 }),
      makeSession({ score: 85, weight_kg: 70 }),
      makeSession({ exercise_id: 'bench', score: 100, weight_kg: 999 }),
    ];

    expect(computePersonalRecord(sessions, 'squat')).toEqual({ bestScore: 90, bestWeightKg: 70 });
  });

  it('retorna bestWeightKg null quando nenhuma sessão registrou carga', () => {
    const sessions = [makeSession({ score: 70, weight_kg: null }), makeSession({ score: 80, weight_kg: null })];

    expect(computePersonalRecord(sessions, 'squat')).toEqual({ bestScore: 80, bestWeightKg: null });
  });
});

describe('detectNewRecords', () => {
  it('considera recorde de score e de carga quando não há histórico', () => {
    expect(detectNewRecords({ score: 80, weightKg: 50 }, null)).toEqual({ score: true, weight: true });
  });

  it('não considera recorde de carga quando a sessão atual não tem carga', () => {
    expect(detectNewRecords({ score: 80, weightKg: null }, null)).toEqual({ score: true, weight: false });
  });

  it('sinaliza recorde apenas quando supera o anterior', () => {
    const previous = { bestScore: 80, bestWeightKg: 50 };

    expect(detectNewRecords({ score: 85, weightKg: 50 }, previous)).toEqual({ score: true, weight: false });
    expect(detectNewRecords({ score: 80, weightKg: 55 }, previous)).toEqual({ score: false, weight: true });
    expect(detectNewRecords({ score: 70, weightKg: 40 }, previous)).toEqual({ score: false, weight: false });
  });
});

describe('detectOverload', () => {
  it('retorna null quando a sessão atual não tem carga', () => {
    expect(detectOverload([makeSession({ weight_kg: 50 })], 'squat', null)).toBeNull();
  });

  it('retorna null quando não há histórico de carga para o exercício', () => {
    expect(detectOverload([], 'squat', 50)).toBeNull();
  });

  it('retorna null quando o aumento está dentro do esperado', () => {
    const sessions = [
      makeSession({ executed_at: '2026-01-01T10:00:00.000Z', weight_kg: 50 }),
      makeSession({ executed_at: '2026-01-02T10:00:00.000Z', weight_kg: 50 }),
    ];

    expect(detectOverload(sessions, 'squat', 55)).toBeNull(); // +10%
  });

  it('sinaliza aumento de carga acima do limite em relação à média recente', () => {
    const sessions = [
      makeSession({ executed_at: '2026-01-01T10:00:00.000Z', weight_kg: 50 }),
      makeSession({ executed_at: '2026-01-02T10:00:00.000Z', weight_kg: 50 }),
    ];

    const overload = detectOverload(sessions, 'squat', 70); // +40%

    expect(overload).toEqual({ averageRecentWeightKg: 50, increasePercent: 40 });
  });

  it('considera só as sessões mais recentes do exercício, ignorando outros exercícios', () => {
    const sessions = [
      makeSession({ executed_at: '2026-01-01T10:00:00.000Z', weight_kg: 100 }), // antiga, fora da janela
      makeSession({ executed_at: '2026-01-05T10:00:00.000Z', weight_kg: 50 }),
      makeSession({ executed_at: '2026-01-06T10:00:00.000Z', weight_kg: 50 }),
      makeSession({ executed_at: '2026-01-07T10:00:00.000Z', weight_kg: 50 }),
      makeSession({ executed_at: '2026-01-08T10:00:00.000Z', weight_kg: 50 }),
      makeSession({ executed_at: '2026-01-09T10:00:00.000Z', weight_kg: 50 }),
      makeSession({ exercise_id: 'bench', executed_at: '2026-01-10T10:00:00.000Z', weight_kg: 200 }),
    ];

    const overload = detectOverload(sessions, 'squat', 70); // +40% sobre média 50 das 5 mais recentes

    expect(overload).toEqual({ averageRecentWeightKg: 50, increasePercent: 40 });
  });
});
