import AsyncStorage from '@react-native-async-storage/async-storage';

export type CameraQuality = 'high' | 'standard' | 'saver';

export type Preferences = {
  cameraQuality: CameraQuality;
  soundFeedback: boolean;
  darkMode: boolean;
  /** Paleta alternativa para indicadores de score/alerta (verde/vermelho → azul/laranja). */
  colorBlindMode: boolean;
  /** Maior contraste entre texto e fundo nas telas de execução/resultado. */
  highContrast: boolean;
  /** Aumenta o tamanho das fontes nas telas de execução/resultado. */
  largeText: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  cameraQuality: 'standard',
  soundFeedback: true,
  darkMode: false,
  colorBlindMode: false,
  highContrast: false,
  largeText: false,
};

const STORAGE_KEY = '@gym_execution/preferences';

/**
 * Preferências locais (README.md — tela de Configurações). Guardadas só
 * no dispositivo via AsyncStorage: não são dados de conta, então não
 * fazem parte da API. "Qualidade da câmera" alimenta diretamente a
 * decisão de performance da seção 5 do README.md.
 */
export async function loadPreferences(): Promise<Preferences> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
