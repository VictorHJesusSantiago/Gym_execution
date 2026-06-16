export type ProfileStats = { trainingCount: number; averageScore: number | null };

/**
 * Agrega "Treinos realizados" e "Pontuação média" (wireframe de Perfil em
 * README.md) a partir dos scores do histórico — sem precisar de um
 * endpoint agregado dedicado no backend. Extraída da `ProfileScreen` para
 * poder ser testada isoladamente, no mesmo padrão de `poseScoring.ts`.
 */
export function computeProfileStats(scores: number[]): ProfileStats {
  if (scores.length === 0) return { trainingCount: 0, averageScore: null };
  const total = scores.reduce((sum, score) => sum + score, 0);
  return { trainingCount: scores.length, averageScore: Math.round(total / scores.length) };
}

/**
 * Sequência atual de dias consecutivos com pelo menos uma sessão registrada
 * (wireframe de Perfil — "Streaks"). Se o usuário ainda não treinou hoje, a
 * sequência pode continuar contando a partir de ontem; se o último treino
 * foi há 2 dias ou mais, a sequência está quebrada (retorna 0).
 */
export function computeStreak(executedAtDates: string[], now: Date = new Date()): number {
  if (executedAtDates.length === 0) return 0;

  const days = new Set(executedAtDates.map((iso) => new Date(iso).toDateString()));

  const cursor = new Date(now);
  if (!days.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
