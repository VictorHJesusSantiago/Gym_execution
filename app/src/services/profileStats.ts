export type ProfileStats = { trainingCount: number; averageScore: number | null };

/**
 * Agrega "Treinos realizados" e "Pontuação média" (wireframe de Perfil em
 * UX_PLAN.md) a partir dos scores do histórico — sem precisar de um
 * endpoint agregado dedicado no backend. Extraída da `ProfileScreen` para
 * poder ser testada isoladamente, no mesmo padrão de `poseScoring.ts`.
 */
export function computeProfileStats(scores: number[]): ProfileStats {
  if (scores.length === 0) return { trainingCount: 0, averageScore: null };
  const total = scores.reduce((sum, score) => sum + score, 0);
  return { trainingCount: scores.length, averageScore: Math.round(total / scores.length) };
}
