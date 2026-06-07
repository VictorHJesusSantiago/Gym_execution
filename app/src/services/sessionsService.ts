import { apiRequest } from './apiClient';

/** Espelha TrainingSessionPublic em backend/app/schemas/session.py. */
export type TrainingSessionPublic = {
  id: string;
  exercise_id: string;
  score: number;
  executed_at: string;
};

export function listMySessions(token: string): Promise<TrainingSessionPublic[]> {
  return apiRequest<TrainingSessionPublic[]>('/sessions', { token });
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
