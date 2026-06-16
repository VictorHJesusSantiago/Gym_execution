import { getContrastColors, getFontScale, scaleFontSize } from '../accessibilityStyles';

describe('getContrastColors', () => {
  it('retorna cores padrão quando o alto contraste está desligado', () => {
    expect(getContrastColors(false)).toEqual({ background: '#ffffff', text: '#1e293b', muted: '#64748b' });
  });

  it('retorna fundo escuro e texto claro quando o alto contraste está ligado', () => {
    const colors = getContrastColors(true);

    expect(colors.background).toBe('#000000');
    expect(colors.text).toBe('#ffffff');
  });
});

describe('getFontScale / scaleFontSize', () => {
  it('não altera o tamanho quando fontes grandes está desligado', () => {
    expect(getFontScale(false)).toBe(1);
    expect(scaleFontSize(16, false)).toBe(16);
  });

  it('aumenta o tamanho quando fontes grandes está ligado', () => {
    expect(getFontScale(true)).toBeGreaterThan(1);
    expect(scaleFontSize(16, true)).toBeGreaterThan(16);
  });
});
