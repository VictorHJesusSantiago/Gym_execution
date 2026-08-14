import { computePeriodReport, computeScoreSeries } from '../trainingReport';
import type { TrainingSessionPublic } from '../sessionsService';

function session(score: number, executedAt: string, weightKg: number | null = null): TrainingSessionPublic {
  return { id: executedAt, exercise_id: 'squat', score, executed_at: executedAt, weight_kg: weightKg };
}

const NOW = new Date('2026-06-14T12:00:00.000Z');

describe('computePeriodReport', () => {
  it('retorna relatório vazio sem sessões', () => {
    expect(computePeriodReport([], 7, NOW)).toEqual({ sessionsCount: 0, averageScore: null, totalWeightKg: 0 });
  });

  it('inclui apenas sessões dentro da janela de dias', () => {
    const sessions = [
      session(80, '2026-06-14T10:00:00.000Z', 50),
      session(60, '2026-06-10T10:00:00.000Z', 40),
      session(90, '2026-06-01T10:00:00.000Z', 100),
    ];

    const report = computePeriodReport(sessions, 7, NOW);

    expect(report.sessionsCount).toBe(2);
    expect(report.averageScore).toBe(70);
    expect(report.totalWeightKg).toBe(90);
  });

  it('trata weight_kg nulo como 0 no total', () => {
    const sessions = [session(80, '2026-06-14T10:00:00.000Z', null)];

    expect(computePeriodReport(sessions, 7, NOW).totalWeightKg).toBe(0);
  });
});

describe('computeScoreSeries', () => {
  it('retorna vazio sem sessões', () => {
    expect(computeScoreSeries([])).toEqual([]);
  });

  it('ordena cronologicamente e limita à quantidade pedida', () => {
    const sessions = [
      session(50, '2026-06-03T10:00:00.000Z'),
      session(30, '2026-06-01T10:00:00.000Z'),
      session(70, '2026-06-02T10:00:00.000Z'),
    ];

    const series = computeScoreSeries(sessions, 2);

    expect(series).toEqual([
      { score: 70, executedAt: '2026-06-02T10:00:00.000Z' },
      { score: 50, executedAt: '2026-06-03T10:00:00.000Z' },
    ]);
  });
});
