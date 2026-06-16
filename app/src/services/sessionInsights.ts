import type { TrainingSessionPublic } from './sessionsService';

export type PersonalRecord = {
  bestScore: number;
  bestWeightKg: number | null;
};

/**
 * Maior score e maior carga já registrados para o exercício, considerando
 * apenas sessões já existentes (anteriores à execução atual).
 */
export function computePersonalRecord(sessions: TrainingSessionPublic[], exerciseId: string): PersonalRecord | null {
  const relevant = sessions.filter((session) => session.exercise_id === exerciseId);
  if (relevant.length === 0) return null;

  const bestScore = Math.max(...relevant.map((session) => session.score));
  const weights = relevant.map((session) => session.weight_kg).filter((weight): weight is number => weight != null);
  const bestWeightKg = weights.length > 0 ? Math.max(...weights) : null;

  return { bestScore, bestWeightKg };
}

export type NewRecords = {
  score: boolean;
  weight: boolean;
};

/** Indica se a sessão atual supera o recorde anterior de score e/ou de carga. */
export function detectNewRecords(
  current: { score: number; weightKg: number | null },
  previous: PersonalRecord | null
): NewRecords {
  return {
    score: previous === null || current.score > previous.bestScore,
    weight:
      current.weightKg != null &&
      (previous === null || previous.bestWeightKg === null || current.weightKg > previous.bestWeightKg),
  };
}

/** Aumento percentual de carga (sobre a média recente) acima do qual avisamos sobre possível sobrecarga. */
export const OVERLOAD_INCREASE_PERCENT = 20;

/** Quantas sessões recentes do exercício (com carga registrada) entram na média de comparação. */
const OVERLOAD_RECENT_SESSIONS = 5;

export type OverloadWarning = {
  averageRecentWeightKg: number;
  increasePercent: number;
};

/**
 * Compara a carga da sessão atual com a média das últimas sessões do mesmo
 * exercício — um salto grande pode indicar progressão de carga arriscada
 * (README.md — "Saúde e segurança"). Retorna `null` quando não há carga
 * atual, histórico de carga, ou o aumento está dentro do esperado.
 */
export function detectOverload(
  sessions: TrainingSessionPublic[],
  exerciseId: string,
  currentWeightKg: number | null
): OverloadWarning | null {
  if (currentWeightKg === null) return null;

  const recentWeights = sessions
    .filter((session) => session.exercise_id === exerciseId && session.weight_kg != null)
    .sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime())
    .slice(0, OVERLOAD_RECENT_SESSIONS)
    .map((session) => session.weight_kg as number);

  if (recentWeights.length === 0) return null;

  const averageRecentWeightKg = recentWeights.reduce((sum, weight) => sum + weight, 0) / recentWeights.length;
  if (averageRecentWeightKg <= 0) return null;

  const increasePercent = Math.round(((currentWeightKg - averageRecentWeightKg) / averageRecentWeightKg) * 100);
  if (increasePercent < OVERLOAD_INCREASE_PERCENT) return null;

  return { averageRecentWeightKg, increasePercent };
}
