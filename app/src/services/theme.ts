import { getContrastColors } from './accessibilityStyles';
import { getScoreColors } from './colorPalette';
import type { Preferences } from './preferencesStorage';

export type Theme = {
  /** Fundo da tela. */
  background: string;
  /** Fundo de cards/seções, um degrau acima do `background`. */
  surface: string;
  text: string;
  muted: string;
  border: string;
  /** Cor de ação primária (botões, links). */
  primary: string;
  onPrimary: string;
  disabled: string;
  danger: string;
  /** Recorde batido, meta atingida (respeita `colorBlindMode`). */
  positive: string;
  /** Sobrecarga, assimetria, fadiga (respeita `colorBlindMode`). */
  warning: string;
  /** Destaque neutro, ex.: a pontuação (respeita `colorBlindMode`). */
  accent: string;
  isDark: boolean;
};

const LIGHT = {
  background: '#ffffff',
  surface: '#f1f5f9',
  text: '#1e293b',
  muted: '#64748b',
  border: '#cbd5e1',
  primary: '#2563eb',
  onPrimary: '#ffffff',
  disabled: '#94a3b8',
  danger: '#dc2626',
};

const DARK = {
  background: '#0f172a',
  surface: '#1e293b',
  text: '#f8fafc',
  muted: '#94a3b8',
  border: '#334155',
  primary: '#60a5fa',
  onPrimary: '#0f172a',
  disabled: '#475569',
  danger: '#f87171',
};

/**
 * Tema efetivo a partir das preferências locais (RF08).
 *
 * Junta três preferências que antes viviam soltas — e uma delas, `darkMode`,
 * era gravada e nunca lida por ninguém: o interruptor existia na tela de
 * Configurações e não fazia absolutamente nada.
 *
 * Precedência: `highContrast` vence `darkMode`. Alto contraste é um recurso de
 * acessibilidade (preto/branco puros, razão 21:1); o modo escuro é preferência
 * estética. Deixar o escuro "amaciar" o alto contraste desfaria justamente a
 * garantia que o usuário pediu ao ligá-lo.
 */
export function getTheme(preferences: Preferences): Theme {
  const base = preferences.darkMode ? DARK : LIGHT;
  const scoreColors = getScoreColors(preferences.colorBlindMode);

  if (preferences.highContrast) {
    const contrast = getContrastColors(true);
    return {
      ...base,
      background: contrast.background,
      surface: '#1a1a1a',
      text: contrast.text,
      muted: contrast.muted,
      border: '#ffffff',
      primary: '#ffffff',
      onPrimary: '#000000',
      ...scoreColors,
      isDark: true,
    };
  }

  return { ...base, ...scoreColors, isDark: preferences.darkMode };
}
