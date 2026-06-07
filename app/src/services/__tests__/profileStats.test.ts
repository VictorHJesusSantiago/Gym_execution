import { computeProfileStats } from '../profileStats';

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
