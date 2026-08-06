import AsyncStorage from '@react-native-async-storage/async-storage';

export type CameraQuality = 'high' | 'standard' | 'saver';

export type Preferences = {
  /** Compressão do JPEG capturado a cada frame — ver `CAMERA_QUALITY_SETTINGS`. */
  cameraQuality: CameraQuality;
  /**
   * Vibra ao detectar um desvio de postura durante a série (ExecutionScreen).
   *
   * Chamava-se `soundFeedback`, mas nada no app jamais tocou som algum: era um
   * interruptor puramente decorativo. O canal de feedback que existe de fato é
   * a vibração — e é o mais adequado durante o exercício, com o celular apoiado
   * longe do usuário. O nome agora descreve o que o código faz; valores
   * gravados sob a chave antiga são migrados em `loadPreferences`.
   */
  vibrationFeedback: boolean;
  /** Tema escuro em todo o app — ver `services/theme.ts`. */
  darkMode: boolean;
  /** Paleta alternativa para indicadores de score/alerta (verde/vermelho → azul/laranja). */
  colorBlindMode: boolean;
  /** Maior contraste entre texto e fundo; vence `darkMode` (ver `theme.ts`). */
  highContrast: boolean;
  /** Aumenta o tamanho das fontes nas telas de execução/resultado. */
  largeText: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  cameraQuality: 'standard',
  vibrationFeedback: true,
  darkMode: false,
  colorBlindMode: false,
  highContrast: false,
  largeText: false,
};

/**
 * Parâmetros de captura por nível de qualidade.
 *
 * `quality` é a compressão do JPEG que `takePictureAsync` devolve e que o
 * detector decodifica frame a frame — o principal custo de memória/CPU do loop
 * de captura, e portanto a alavanca real do RNF01 (aparelhos de 2GB).
 *
 * A TAXA de amostragem não entra aqui de propósito: DOM05 fixa ~10fps
 * (`SAMPLE_INTERVAL_MS`) e o pipeline offline extrai a referência exatamente
 * nessa taxa (`SAMPLE_INTERVAL_MS` em extract_pose_sequence.py). Deixar o
 * usuário mexer nisso desalinharia a captura da referência com que ela é
 * comparada.
 */
export const CAMERA_QUALITY_SETTINGS: Record<CameraQuality, { quality: number }> = {
  high: { quality: 0.8 },
  standard: { quality: 0.5 },
  saver: { quality: 0.3 },
};

const STORAGE_KEY = '@gym_execution/preferences';

/**
 * Preferências locais (README.md — tela de Configurações). Guardadas só
 * no dispositivo via AsyncStorage: não são dados de conta, então não
 * fazem parte da API (RN08/DAT06).
 */
export async function loadPreferences(): Promise<Preferences> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    return { ...DEFAULT_PREFERENCES, ...migrate(JSON.parse(raw)) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

/**
 * Converte o formato gravado por versões anteriores. Sem isto, quem já tinha
 * desligado o feedback veria a preferência voltar sozinha para o padrão ao
 * atualizar o app — um "reset silencioso" é pior do que não ter a preferência.
 */
function migrate(stored: Record<string, unknown>): Record<string, unknown> {
  const { soundFeedback, ...rest } = stored;
  if (typeof soundFeedback === 'boolean' && rest.vibrationFeedback === undefined) {
    return { ...rest, vibrationFeedback: soundFeedback };
  }
  return rest;
}
