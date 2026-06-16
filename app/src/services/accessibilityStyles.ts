export type ContrastColors = {
  background: string;
  text: string;
  muted: string;
};

const DEFAULT_CONTRAST: ContrastColors = { background: '#ffffff', text: '#1e293b', muted: '#64748b' };
const HIGH_CONTRAST: ContrastColors = { background: '#000000', text: '#ffffff', muted: '#e2e8f0' };

/** Cores de fundo/texto para o modo alto contraste (`Preferences.highContrast`). */
export function getContrastColors(highContrast: boolean): ContrastColors {
  return highContrast ? HIGH_CONTRAST : DEFAULT_CONTRAST;
}

const LARGE_TEXT_SCALE = 1.3;

/** Fator multiplicador de `fontSize` para o modo de fontes grandes (`Preferences.largeText`). */
export function getFontScale(largeText: boolean): number {
  return largeText ? LARGE_TEXT_SCALE : 1;
}

/** Aplica o fator de `getFontScale` a um tamanho de fonte base, arredondando para inteiro. */
export function scaleFontSize(baseSize: number, largeText: boolean): number {
  return Math.round(baseSize * getFontScale(largeText));
}
