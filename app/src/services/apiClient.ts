/**
 * Cliente HTTP fino para a API (ver backend/README.md). Centraliza a base
 * URL e o cabeçalho de autenticação, evitando repetir `fetch` espalhado
 * pelo app — cada serviço (auth, sessions, exercises) constrói sobre isto.
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

/**
 * Acionado quando uma requisição *autenticada* (com `token`) recebe 401 —
 * tipicamente um JWT expirado (ver `jwt_expire_minutes` no backend). O
 * `AuthProvider` (useAuth.tsx) registra aqui um handler que limpa o token e
 * volta o app para a tela de login, evitando que o usuário fique numa tela
 * travada mostrando só uma mensagem de erro.
 *
 * Implementado como callback registrável (em vez de `apiClient` importar
 * `useAuth`) para não criar uma dependência circular entre o cliente HTTP e
 * o estado de autenticação.
 */
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    // Só dispara o logout automático se a própria requisição usava um token
    // — um 401 em /auth/login (credenciais inválidas) não é "sessão expirada".
    if (response.status === 401 && token) {
      unauthorizedHandler?.();
    }

    const payload = await response.json().catch(() => null);
    const message = payload?.detail ?? `Erro ${response.status} ao chamar ${path}`;
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
