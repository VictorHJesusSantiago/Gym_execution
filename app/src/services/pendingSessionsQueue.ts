import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from './apiClient';
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
 * Teto da fila. Cada item é minúsculo, mas sem limite ela cresce para sempre
 * quando o envio falha de forma sistemática (foi o que aconteceu enquanto os
 * ids do catálogo divergiam do backend: todo `POST /sessions` dava 422 e cada
 * série treinada virava mais um item eterno no AsyncStorage). Ao estourar,
 * descartamos os MAIS ANTIGOS: histórico recente é o que o usuário ainda
 * espera ver aparecer.
 */
const MAX_PENDING_SESSIONS = 200;

/**
 * Fila de resultados pendentes de envio (README.md seção 5 — score é
 * calculado localmente e só depois sincronizado). Guardada via AsyncStorage
 * para sobreviver ao fechamento do app enquanto o usuário está offline.
 */
export async function enqueuePendingSession(pending: PendingSession): Promise<void> {
  const queue = await loadQueue();
  queue.push(pending);
  await saveQueue(queue.slice(-MAX_PENDING_SESSIONS));
}

/**
 * Tenta reenviar todas as sessões pendentes — chamado ao focar `HistoryScreen`
 * (quando a conectividade/sessão provavelmente foi restaurada).
 *
 * Itens que falham por rede/servidor permanecem na fila; itens rejeitados pelo
 * servidor de forma permanente (4xx que não seja timeout/rate limit) são
 * DESCARTADOS. Antes qualquer erro fazia o item voltar para a fila, então um
 * payload que o servidor nunca vai aceitar — exercício removido do catálogo,
 * score inválido — era reenviado a cada visita ao histórico, para sempre.
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
    } catch (error) {
      if (isPermanentRejection(error)) {
        console.warn(
          '[pendingSessionsQueue] sessão descartada — o servidor a rejeita permanentemente',
          { exerciseId: pending.exerciseId, status: (error as ApiError).status }
        );
        continue;
      }
      remaining.push(pending);
    }
  }

  await saveQueue(remaining);
}

/**
 * O servidor recusou de forma definitiva? Só 4xx conta, e mesmo assim com
 * exceções: 401/403 podem virar sucesso depois de um refresh de token, 408 e
 * 429 são explicitamente "tente de novo".
 */
function isPermanentRejection(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if ([401, 403, 408, 429].includes(error.status)) return false;
  return error.status >= 400 && error.status < 500;
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
