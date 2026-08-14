const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** Headers extras (ex.: `Idempotency-Key`). */
  headers?: Record<string, string>;
};

let unauthorizedHandler: (() => void) | null = null;
let tokenRefreshHandler: (() => Promise<string | null>) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/** Registrado pelo AuthProvider para trocar silenciosamente o access token
 * quando uma chamada autenticada recebe 401 — evita logout imediato por
 * token expirado (access tokens têm vida curta, 30 min). */
export function setTokenRefreshHandler(handler: (() => Promise<string | null>) | null): void {
  tokenRefreshHandler = handler;
}

/** Refresh em andamento, compartilhado entre chamadas concorrentes. */
let inFlightRefresh: Promise<string | null> | null = null;

/**
 * Single-flight do refresh: quando várias requisições autenticadas recebem
 * 401 ao mesmo tempo (ex.: tela que dispara N chamadas no mount), todas
 * aguardam o MESMO refresh. Sem isso, cada 401 dispararia um refresh com o
 * mesmo refresh token — mas o backend rotaciona/invalida o token no primeiro
 * uso, então as demais falhariam e provocariam logout espúrio em cascata.
 */
function refreshTokenOnce(): Promise<string | null> {
  if (!tokenRefreshHandler) return Promise.resolve(null);
  if (!inFlightRefresh) {
    inFlightRefresh = tokenRefreshHandler().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function executeRequest<T>(path: string, options: RequestOptions, isRetry = false): Promise<T> {
  const { method = 'GET', body, token, headers: extraHeaders } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    if (response.status === 401 && token && !isRetry) {
      const newToken = await refreshTokenOnce();
      if (newToken) {
        return executeRequest<T>(path, { ...options, token: newToken }, true);
      }
      unauthorizedHandler?.();
    }

    const payload = await response.json().catch(() => null);
    const message = payload?.detail ?? `Erro ${response.status} ao chamar ${path}`;
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return executeRequest<T>(path, options);
}
