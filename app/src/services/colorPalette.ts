export type ScoreColors = {
  /** Resultado positivo: recorde batido, meta atingida, pontuação alta. */
  positive: string;
  /** Alerta: sobrecarga, assimetria, fadiga. */
  warning: string;
  /** Destaque neutro (pontuação numérica). */
  accent: string;
};

const DEFAULT_PALETTE: ScoreColors = { positive: '#16a34a', warning: '#dc2626', accent: '#2563eb' };

// Verde/vermelho são difíceis de distinguir no daltonismo mais comum
// (protanopia/deuteranopia) — troca para azul/laranja, com maior contraste.
const COLOR_BLIND_PALETTE: ScoreColors = { positive: '#2563eb', warning: '#d97706', accent: '#7c3aed' };

/** Paleta de cores para indicadores de score/alerta, conforme `Preferences.colorBlindMode`. */
export function getScoreColors(colorBlindMode: boolean): ScoreColors {
  return colorBlindMode ? COLOR_BLIND_PALETTE : DEFAULT_PALETTE;
}
