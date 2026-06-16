import type { TrainingSessionPublic } from './sessionsService';

export type Achievement = {
  id: string;
  title: string;
  unlocked: boolean;
};

/**
 * Conquistas derivadas do histórico e da sequência de dias já calculados
 * (`sessions`/`computeStreak`) — sem necessidade de armazenamento extra,
 * no mesmo espírito de `sessionInsights.ts`.
 */
export function computeAchievements(sessions: TrainingSessionPublic[], streakDays: number): Achievement[] {
  const sessionsCount = sessions.length;
  const bestScore = sessions.length > 0 ? Math.max(...sessions.map((session) => session.score)) : 0;

  return [
    { id: 'first_session', title: 'Primeiro treino', unlocked: sessionsCount >= 1 },
    { id: 'five_sessions', title: '5 treinos completos', unlocked: sessionsCount >= 5 },
    { id: 'twenty_sessions', title: '20 treinos completos', unlocked: sessionsCount >= 20 },
    { id: 'streak_3', title: 'Sequência de 3 dias', unlocked: streakDays >= 3 },
    { id: 'streak_7', title: 'Sequência de 7 dias', unlocked: streakDays >= 7 },
    { id: 'score_90', title: 'Pontuação acima de 90%', unlocked: bestScore >= 90 },
  ];
}
