import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordSession } from './sessionsService';

/** Resultado de uma série que falhou ao registrar (ex.: sem conexão). */
export type PendingSession = {
  exerciseId: string;
  score: number;
  executedAt: string; // ISO 8601 — ver TrainingSessionCreate.executed_at
  weightKg?: number | null;
};

const STORAGE_KEY = '@gym_execution/pending_sessions';

/**
 * Fila de resultados pendentes de envio (README.md seção 5 — score é
 * calculado localmente e só depois sincronizado). Guardada via AsyncStorage
 * para sobreviver ao fechamento do app enquanto o usuário está offline.
 */
export async function enqueuePendingSession(pending: PendingSession): Promise<void> {
  const queue = await loadQueue();
  queue.push(pending);
  await saveQueue(queue);
}

/**
 * Tenta reenviar todas as sessões pendentes — chamado ao focar `HistoryScreen`
 * (quando a conectividade/sessão provavelmente foi restaurada). Itens que
 * falharem de novo permanecem na fila para a próxima tentativa.
 */
export async function drainPendingSessions(token: string): Promise<void> {
  const queue = await loadQueue();
  if (queue.length === 0) return;

  const remaining: PendingSession[] = [];
  for (const pending of queue) {
    try {
      await recordSession(
        token,
        pending.exerciseId,
        pending.score,
        new Date(pending.executedAt),
        pending.weightKg
      );
    } catch {
      remaining.push(pending);
    }
  }

  await saveQueue(remaining);
}

/** Quantas sessões ainda estão na fila de sincronização — usado para exibir um aviso no histórico. */
export async function countPendingSessions(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}

async function loadQueue(): Promise<PendingSession[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: PendingSession[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}
