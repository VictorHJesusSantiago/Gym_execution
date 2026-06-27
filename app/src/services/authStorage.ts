import * as SecureStore from 'expo-secure-store';

/**
 * Persistência de tokens em armazenamento seguro do dispositivo
 * (Keychain no iOS, Android Keystore no Android).
 *
 * Access token: vida curta (30 min) — renovado automaticamente via refresh.
 * Refresh token: vida longa (30 dias) — rotacionado a cada uso em /auth/refresh.
 */

const TOKEN_KEY = 'gym_execution_access_token';
const REFRESH_TOKEN_KEY = 'gym_execution_refresh_token';

export function saveToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function clearToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function saveRefreshToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export function loadRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export function clearRefreshToken(): Promise<void> {
  return SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
