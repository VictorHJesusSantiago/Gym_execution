// `DEFAULT_PREFERENCES` vive em preferencesStorage, que importa AsyncStorage no
// topo — sem o mock oficial o módulo nativo é nulo e a suíte nem carrega.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { DEFAULT_PREFERENCES, type Preferences } from '../preferencesStorage';
import { getTheme } from '../theme';

function preferences(overrides: Partial<Preferences> = {}): Preferences {
  return { ...DEFAULT_PREFERENCES, ...overrides };
}

describe('getTheme', () => {
  it('usa a paleta clara por padrão', () => {
    const theme = getTheme(preferences());

    expect(theme.isDark).toBe(false);
    expect(theme.background).toBe('#ffffff');
  });

  it('darkMode troca de verdade o fundo e o texto', () => {
    // Regressão: `darkMode` era gravado pela tela de Configurações e nunca lido
    // por ninguém — o interruptor não fazia absolutamente nada.
    const theme = getTheme(preferences({ darkMode: true }));

    expect(theme.isDark).toBe(true);
    expect(theme.background).toBe('#0f172a');
    expect(theme.text).toBe('#f8fafc');
  });

  it('highContrast tem prioridade sobre darkMode', () => {
    // Alto contraste é acessibilidade (preto/branco puros); deixar o modo
    // escuro suavizá-lo desfaria a garantia que o usuário pediu.
    const theme = getTheme(preferences({ darkMode: true, highContrast: true }));

    expect(theme.background).toBe('#000000');
    expect(theme.text).toBe('#ffffff');
  });

  it('highContrast vale mesmo sem darkMode', () => {
    const theme = getTheme(preferences({ highContrast: true }));

    expect(theme.background).toBe('#000000');
    expect(theme.isDark).toBe(true);
  });

  it('colorBlindMode troca verde/vermelho por azul/laranja em qualquer tema', () => {
    const light = getTheme(preferences({ colorBlindMode: true }));
    const dark = getTheme(preferences({ colorBlindMode: true, darkMode: true }));

    expect(light.positive).toBe('#2563eb');
    expect(light.warning).toBe('#d97706');
    expect(dark.positive).toBe(light.positive);
  });

  it('texto e fundo nunca coincidem, em nenhuma combinação', () => {
    for (const darkMode of [false, true]) {
      for (const highContrast of [false, true]) {
        const theme = getTheme(preferences({ darkMode, highContrast }));
        expect(theme.text).not.toBe(theme.background);
        expect(theme.onPrimary).not.toBe(theme.primary);
      }
    }
  });
});
