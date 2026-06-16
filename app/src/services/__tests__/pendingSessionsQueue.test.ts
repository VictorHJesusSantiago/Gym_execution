jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../sessionsService', () => ({
  recordSession: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { countPendingSessions, drainPendingSessions, enqueuePendingSession, type PendingSession } from '../pendingSessionsQueue';
import { recordSession } from '../sessionsService';

const PENDING: PendingSession = {
  exerciseId: 'squat',
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
});
