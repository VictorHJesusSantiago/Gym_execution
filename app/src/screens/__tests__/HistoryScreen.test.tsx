jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'token-de-teste', status: 'signedIn', signOut: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));

jest.mock('../../services/sessionsService', () => ({
  listMySessions: jest.fn(),
  SESSIONS_PAGE_SIZE: 20,
}));

jest.mock('../../services/pendingSessionsQueue', () => ({
  drainPendingSessions: jest.fn().mockResolvedValue(undefined),
  countPendingSessions: jest.fn().mockResolvedValue(0),
}));

import { createElement } from 'react';
import { HistoryScreen } from '../HistoryScreen';
import { ApiError } from '../../services/apiClient';
import { listMySessions, type TrainingSessionPublic } from '../../services/sessionsService';
import { countPendingSessions, drainPendingSessions } from '../../services/pendingSessionsQueue';
import { renderWithProviders, renderedText } from './renderHelpers';

function session(overrides: Partial<TrainingSessionPublic> = {}): TrainingSessionPublic {
  return {
    id: 'sessao-1',
    exercise_id: 'agachamento',
    score: 87,
    executed_at: '2026-06-01T10:00:00.000Z',
    weight_kg: null,
    ...overrides,
  };
}

const render = () => createElement(HistoryScreen);

describe('HistoryScreen', () => {
  beforeEach(() => {
    (listMySessions as jest.Mock).mockReset().mockResolvedValue([]);
    (drainPendingSessions as jest.Mock).mockClear().mockResolvedValue(undefined);
    (countPendingSessions as jest.Mock).mockClear().mockResolvedValue(0);
  });

  it('mostra estado vazio quando não há treinos', async () => {
    expect(renderedText(await renderWithProviders(render()))).toContain('Nenhum treino registrado ainda');
  });

  it('lista as sessões com nome do exercício, pontuação e carga', async () => {
    (listMySessions as jest.Mock).mockResolvedValue([session({ weight_kg: 42.5 })]);

    const text = renderedText(await renderWithProviders(render()));

    expect(text).toContain('Agachamento');
    expect(text).toContain('87%');
    expect(text).toContain('42.5 kg');
  });

  it('drena a fila offline ANTES de carregar, para o pendente já aparecer', async () => {
    await renderWithProviders(render());

    expect(drainPendingSessions).toHaveBeenCalledWith('token-de-teste');
    expect(listMySessions).toHaveBeenCalled();
  });

  it('avisa quando há sessões não sincronizadas, no singular e no plural', async () => {
    (countPendingSessions as jest.Mock).mockResolvedValue(1);
    expect(renderedText(await renderWithProviders(render()))).toContain('1 sessão ainda não foi sincronizada');

    (countPendingSessions as jest.Mock).mockResolvedValue(3);
    expect(renderedText(await renderWithProviders(render()))).toContain(
      '3 sessões ainda não foram sincronizadas'
    );
  });

  it('mostra a mensagem do backend quando a carga falha', async () => {
    (listMySessions as jest.Mock).mockRejectedValue(new ApiError(503, 'Serviço indisponível'));

    expect(renderedText(await renderWithProviders(render()))).toContain('Serviço indisponível');
  });

  it('uma falha ao drenar não impede o histórico de carregar', async () => {
    (drainPendingSessions as jest.Mock).mockRejectedValue(new Error('offline'));
    (listMySessions as jest.Mock).mockResolvedValue([session()]);

    expect(renderedText(await renderWithProviders(render()))).toContain('Agachamento');
  });

  it('exercício desconhecido cai no id cru em vez de sumir da lista', async () => {
    (listMySessions as jest.Mock).mockResolvedValue([session({ exercise_id: 'exercicio-novo' })]);

    expect(renderedText(await renderWithProviders(render()))).toContain('exercicio-novo');
  });
});
