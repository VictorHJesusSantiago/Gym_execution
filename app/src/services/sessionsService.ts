import { apiRequest } from './apiClient';

/** Espelha TrainingSessionPublic em backend/app/schemas/session.py. */
export type TrainingSessionPublic = {
  id: string;
  exercise_id: string;
  score: number;
  executed_at: string;
  weight_kg: number | null;
};

/** Espelha SessionStats em backend/app/schemas/session.py. */
export type SessionStats = {
  total_sessions: number;
  avg_score: number | null;
  best_score: number | null;
  exercises_count: number;
};

export const SESSIONS_PAGE_SIZE = 20;

export function listMySessions(
  token: string,
  options: { offset?: number; limit?: number } = {}
): Promise<TrainingSessionPublic[]> {
  const { offset = 0, limit = SESSIONS_PAGE_SIZE } = options;
  return apiRequest<TrainingSessionPublic[]>(`/sessions?limit=${limit}&offset=${offset}`, { token });
}

/**
 * Busca o histórico completo para features que precisam dos dados brutos
 * (achievements, gráfico de evolução, CSV export). Para estatísticas
 * simples (total, média), prefira `getMyStats` — muito mais eficiente.
 */
export async function listAllMySessions(token: string): Promise<TrainingSessionPublic[]> {
  const pageSize = 100;
  const all: TrainingSessionPublic[] = [];
  let offset = 0;

  for (;;) {
    const page = await listMySessions(token, { offset, limit: pageSize });
    all.push(...page);
    if (page.length < pageSize) return all;
    offset += pageSize;
  }
}

/**
 * Estatísticas agregadas do usuário (M4) — calculadas server-side em uma
 * única query SQL em vez de buscar todas as sessões no cliente.
 */
export function getMyStats(token: string): Promise<SessionStats> {
  return apiRequest<SessionStats>('/sessions/stats', { token });
}

export function recordSession(
  token: string,
  exerciseId: string,
  score: number,
  executedAt: Date,
  weightKg?: number | null
): Promise<TrainingSessionPublic> {
  return apiRequest<TrainingSessionPublic>('/sessions', {
    method: 'POST',
    token,
    body: {
      exercise_id: exerciseId,
      score,
      executed_at: executedAt.toISOString(),
      weight_kg: weightKg ?? null,
    },
  });
}
