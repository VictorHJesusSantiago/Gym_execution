import { computeAchievements } from '../achievements';
import type { TrainingSessionPublic } from '../sessionsService';

function session(score: number): TrainingSessionPublic {
  return { id: `${score}`, exercise_id: 'squat', score, executed_at: '2026-01-01T10:00:00.000Z', weight_kg: null };
}

describe('computeAchievements', () => {
  it('nenhuma conquista desbloqueada sem histórico nem sequência', () => {
    const achievements = computeAchievements([], 0);

    expect(achievements.every((achievement) => !achievement.unlocked)).toBe(true);
  });

  it('desbloqueia "Primeiro treino" com 1 sessão', () => {
    const achievements = computeAchievements([session(50)], 0);

    expect(achievements.find((a) => a.id === 'first_session')?.unlocked).toBe(true);
    expect(achievements.find((a) => a.id === 'five_sessions')?.unlocked).toBe(false);
  });

  it('desbloqueia "5 treinos completos" e "20 treinos completos" pela contagem', () => {
    const fiveSessions = Array.from({ length: 5 }, () => session(50));
    const twentySessions = Array.from({ length: 20 }, () => session(50));

    expect(computeAchievements(fiveSessions, 0).find((a) => a.id === 'five_sessions')?.unlocked).toBe(true);
    expect(computeAchievements(twentySessions, 0).find((a) => a.id === 'twenty_sessions')?.unlocked).toBe(true);
  });

  it('desbloqueia conquistas de sequência pelo streakDays', () => {
    const achievements = computeAchievements([], 7);

    expect(achievements.find((a) => a.id === 'streak_3')?.unlocked).toBe(true);
    expect(achievements.find((a) => a.id === 'streak_7')?.unlocked).toBe(true);
  });

  it('desbloqueia "Pontuação acima de 90%" quando alguma sessão atinge 90', () => {
    const achievements = computeAchievements([session(70), session(95)], 0);

    expect(achievements.find((a) => a.id === 'score_90')?.unlocked).toBe(true);
  });
});
