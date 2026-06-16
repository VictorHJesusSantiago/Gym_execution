import { buildResultShareText } from '../resultShareText';

describe('buildResultShareText', () => {
  it('inclui apenas a pontuação quando não há mais informações', () => {
    const text = buildResultShareText({ exerciseName: 'Agachamento', score: 80 });

    expect(text).toBe('Agachamento: 80% de pontuação\nRegistrado com o app Gym Execution.');
  });

  it('inclui repetições, carga, recordes, sobrecarga e fadiga quando presentes', () => {
    const text = buildResultShareText({
      exerciseName: 'Agachamento',
      score: 95,
      repCount: 8,
      weightKg: 60,
      newRecords: { score: true, weight: true },
      overload: { averageRecentWeightKg: 50, increasePercent: 25 },
      fatigue: { repCount: 8, consistencyPercent: 60, degraded: true },
    });

    expect(text.split('\n')).toEqual([
      'Agachamento: 95% de pontuação',
      'Repetições: 8',
      'Carga: 60kg',
      'Novo recorde de pontuação!',
      'Novo recorde de carga!',
      'Atenção: carga 25% acima da média recente.',
      'Possível sinal de fadiga (60% de consistência).',
      'Registrado com o app Gym Execution.',
    ]);
  });

  it('não inclui repCount quando é 0', () => {
    const text = buildResultShareText({ exerciseName: 'Agachamento', score: 80, repCount: 0 });

    expect(text).not.toContain('Repetições');
  });
});
