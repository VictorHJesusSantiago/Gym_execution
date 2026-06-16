import { computeProfileStats, computeStreak } from '../profileStats';

describe('computeProfileStats', () => {
  it('retorna contagem zero e média nula quando não há sessões', () => {
    expect(computeProfileStats([])).toEqual({ trainingCount: 0, averageScore: null });
  });

  it('conta as sessões e arredonda a média dos scores', () => {
    const stats = computeProfileStats([80, 90, 100]);

    expect(stats).toEqual({ trainingCount: 3, averageScore: 90 });
  });

  it('arredonda a média para o inteiro mais próximo', () => {
    const stats = computeProfileStats([70, 80, 80]);

    expect(stats.trainingCount).toBe(3);
    expect(stats.averageScore).toBe(77); // 76.66... arredonda para 77
  });

  it('funciona com uma única sessão', () => {
    expect(computeProfileStats([85])).toEqual({ trainingCount: 1, averageScore: 85 });
  });
});

describe('computeStreak', () => {
  const NOW = new Date('2026-01-10T12:00:00.000Z');

  it('retorna 0 quando não há sessões', () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it('conta o dia de hoje quando há sessão hoje', () => {
    expect(computeStreak(['2026-01-10T08:00:00.000Z'], NOW)).toBe(1);
  });

  it('conta dias consecutivos incluindo hoje', () => {
    const dates = ['2026-01-08T08:00:00.000Z', '2026-01-09T08:00:00.000Z', '2026-01-10T08:00:00.000Z'];

    expect(computeStreak(dates, NOW)).toBe(3);
  });

  it('continua contando a partir de ontem se ainda não treinou hoje', () => {
    const dates = ['2026-01-08T08:00:00.000Z', '2026-01-09T08:00:00.000Z'];

    expect(computeStreak(dates, NOW)).toBe(2);
  });

  it('retorna 0 quando o último treino foi há 2 dias ou mais', () => {
    expect(computeStreak(['2026-01-07T08:00:00.000Z'], NOW)).toBe(0);
  });

  it('conta múltiplas sessões no mesmo dia como um único dia', () => {
    const dates = ['2026-01-10T08:00:00.000Z', '2026-01-10T18:00:00.000Z'];

    expect(computeStreak(dates, NOW)).toBe(1);
  });
});
