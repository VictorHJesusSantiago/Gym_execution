import * as SecureStore from 'expo-secure-store';

/**
 * Persistência do token JWT em armazenamento seguro do dispositivo
 * (Keychain no iOS, Android Keystore no Android) — nunca em AsyncStorage
 * simples, que guarda dados em texto puro.
 *
 * Trade-off com o requisito de hardware antigo (README.md): o
 * Android Keystore exige API 23+ (Android 6.0, fim de 2015), por isso
 * `app.json` foi ajustado de minSdkVersion 21 para 23 — ainda alinhado
 * ao "a partir de 2015", apenas restringindo a poucos meses iniciais
 * daquele ano (Android 5.x). Optou-se por manter a segurança do token
 * em vez de degradar para armazenamento em texto puro nesses aparelhos.
 */

const TOKEN_KEY = 'gym_execution_access_token';

export function saveToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function clearToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}
