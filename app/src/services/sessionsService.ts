import { apiRequest } from './apiClient';

/** Espelha TrainingSessionPublic em backend/app/schemas/session.py. */
export type TrainingSessionPublic = {
  id: string;
  exercise_id: string;
  score: number;
  executed_at: string;
};

export const SESSIONS_PAGE_SIZE = 20;

/**
 * Espelha `limit`/`offset` de `GET /sessions` (backend/app/routers/sessions.py).
 * Uma página com menos itens que `SESSIONS_PAGE_SIZE` indica que não há mais
 * páginas — usado por `HistoryScreen` para decidir se mostra "carregar mais".
 */
export function listMySessions(
  token: string,
  options: { offset?: number; limit?: number } = {}
): Promise<TrainingSessionPublic[]> {
  const { offset = 0, limit = SESSIONS_PAGE_SIZE } = options;
  return apiRequest<TrainingSessionPublic[]>(`/sessions?limit=${limit}&offset=${offset}`, { token });
}

/**
 * Busca o histórico completo percorrendo todas as páginas — usado por
 * `ProfileScreen` para calcular estatísticas agregadas (treinos realizados/
 * pontuação média), que precisam do total e não só da primeira página.
 * Usa o `limit` máximo aceito pela API (100) para minimizar requisições.
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
 * Envia apenas o resultado já calculado no dispositivo (nunca o vídeo
 * bruto — ver ARCHITECTURE.md seção 5 e backend/app/routers/sessions.py).
 */
export function recordSession(
  token: string,
  exerciseId: string,
  score: number,
  executedAt: Date
): Promise<TrainingSessionPublic> {
  return apiRequest<TrainingSessionPublic>('/sessions', {
    method: 'POST',
    token,
    body: { exercise_id: exerciseId, score, executed_at: executedAt.toISOString() },
  });
}
