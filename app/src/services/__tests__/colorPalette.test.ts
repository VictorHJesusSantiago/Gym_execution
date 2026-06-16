import { getScoreColors } from '../colorPalette';

describe('getScoreColors', () => {
  it('retorna a paleta padrão quando o modo daltonismo está desligado', () => {
    expect(getScoreColors(false)).toEqual({ positive: '#16a34a', warning: '#dc2626', accent: '#2563eb' });
  });

  it('retorna uma paleta alternativa (sem verde/vermelho) quando o modo daltonismo está ligado', () => {
    const colors = getScoreColors(true);

    expect(colors.positive).not.toBe('#16a34a');
    expect(colors.warning).not.toBe('#dc2626');
  });
});
