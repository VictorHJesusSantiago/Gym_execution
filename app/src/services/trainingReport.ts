import type { TrainingSessionPublic } from './sessionsService';

export type PeriodReport = {
  sessionsCount: number;
  averageScore: number | null;
  totalWeightKg: number;
};

/**
 * Agrega sessões dos últimos `days` dias (relatório semanal/mensal do
 * Perfil) — mesmo padrão de agregação pura de `profileStats.ts`.
 */
export function computePeriodReport(
  sessions: TrainingSessionPublic[],
  days: number,
  now: Date = new Date()
): PeriodReport {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  const recent = sessions.filter((session) => {
    const executedAt = new Date(session.executed_at);
    return executedAt >= cutoff && executedAt <= now;
  });

  const totalWeightKg = recent.reduce((sum, session) => sum + (session.weight_kg ?? 0), 0);
  const averageScore =
    recent.length > 0 ? Math.round(recent.reduce((sum, session) => sum + session.score, 0) / recent.length) : null;

  return { sessionsCount: recent.length, averageScore, totalWeightKg };
}

export type ScorePoint = { score: number; executedAt: string };

/** Últimos `limit` pontos de pontuação em ordem cronológica — usado no gráfico de evolução do Perfil. */
export function computeScoreSeries(sessions: TrainingSessionPublic[], limit = 10): ScorePoint[] {
  return [...sessions]
    .sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime())
    .slice(-limit)
    .map((session) => ({ score: session.score, executedAt: session.executed_at }));
}
