jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../sessionsService', () => ({
  recordSession: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '../apiClient';
import { countPendingSessions, drainPendingSessions, enqueuePendingSession, type PendingSession } from '../pendingSessionsQueue';
import { recordSession } from '../sessionsService';

const PENDING: PendingSession = {
  exerciseId: 'agachamento',
  score: 80,
  executedAt: '2026-01-01T10:00:00.000Z',
  weightKg: 50,
};

describe('pendingSessionsQueue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (recordSession as jest.Mock).mockReset();
  });

  it('countPendingSessions retorna 0 quando a fila está vazia', async () => {
    expect(await countPendingSessions()).toBe(0);
  });

  it('enqueuePendingSession adiciona à fila', async () => {
    await enqueuePendingSession(PENDING);

    expect(await countPendingSessions()).toBe(1);
  });

  it('drainPendingSessions reenvia e esvazia a fila quando a API responde', async () => {
    (recordSession as jest.Mock).mockResolvedValue({});
    await enqueuePendingSession(PENDING);

    await drainPendingSessions('token');

    expect(recordSession).toHaveBeenCalledWith('token', PENDING.exerciseId, PENDING.score, new Date(PENDING.executedAt), PENDING.weightKg);
    expect(await countPendingSessions()).toBe(0);
  });

  it('drainPendingSessions mantém na fila os itens que falharem de novo', async () => {
    (recordSession as jest.Mock).mockRejectedValue(new Error('offline'));
    await enqueuePendingSession(PENDING);

    await drainPendingSessions('token');

    expect(await countPendingSessions()).toBe(1);
  });

  it('drainPendingSessions descarta o que o servidor rejeita permanentemente (422)', async () => {
    // Regressão: qualquer erro devolvia o item à fila, então um payload que o
    // servidor nunca aceitaria (ex.: exercise_id inexistente) era reenviado a
    // cada visita ao histórico, para sempre.
    (recordSession as jest.Mock).mockRejectedValue(new ApiError(422, 'exercise_id não encontrado'));
    await enqueuePendingSession(PENDING);

    await drainPendingSessions('token');

    expect(await countPendingSessions()).toBe(0);
  });

  it('drainPendingSessions mantém o item em 401/429 (recuperável após refresh/espera)', async () => {
    (recordSession as jest.Mock).mockRejectedValue(new ApiError(401, 'token expirado'));
    await enqueuePendingSession(PENDING);

    await drainPendingSessions('token');

    expect(await countPendingSessions()).toBe(1);
  });

  it('a fila não cresce sem limite: mantém as sessões mais recentes', async () => {
    (recordSession as jest.Mock).mockRejectedValue(new Error('offline'));

    for (let index = 0; index < 205; index++) {
      await enqueuePendingSession({ ...PENDING, score: index });
    }

    expect(await countPendingSessions()).toBe(200);
    const raw = await AsyncStorage.getItem('@gym_execution/pending_sessions');
    const queue = JSON.parse(raw as string) as PendingSession[];
    expect(queue[queue.length - 1].score).toBe(204); // a mais recente sobreviveu
    expect(queue[0].score).toBe(5); // as 5 mais antigas foram descartadas
  });
});
