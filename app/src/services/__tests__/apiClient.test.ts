import { apiRequest, ApiError, setUnauthorizedHandler } from '../apiClient';

function mockFetchResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('apiRequest', () => {
  afterEach(() => {
    setUnauthorizedHandler(null);
    jest.restoreAllMocks();
  });

  it('lança ApiError com a mensagem do backend em respostas de erro', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockFetchResponse(404, { detail: 'Exercício não encontrado' }));

    const error = await apiRequest('/exercises/x').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).message).toBe('Exercício não encontrado');
  });

  it('usa mensagem padrão quando o backend não retorna corpo JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('não é JSON');
      },
    } as unknown as Response);

    const error = await apiRequest('/sessions').catch((e) => e);

    expect((error as ApiError).message).toBe('Erro 500 ao chamar /sessions');
  });

  it('dispara o handler de não-autorizado em 401 de chamada autenticada, mas não em /auth/login', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);

    global.fetch = jest.fn().mockResolvedValue(mockFetchResponse(401, { detail: 'Token inválido ou expirado' }));

    await apiRequest('/users/me', { token: 'expired-token' }).catch(() => {});
    expect(handler).toHaveBeenCalledTimes(1);

    handler.mockClear();
    global.fetch = jest.fn().mockResolvedValue(mockFetchResponse(401, { detail: 'Credenciais inválidas' }));

    await apiRequest('/auth/login', { method: 'POST', body: {} }).catch(() => {});
    expect(handler).not.toHaveBeenCalled();
  });
});
