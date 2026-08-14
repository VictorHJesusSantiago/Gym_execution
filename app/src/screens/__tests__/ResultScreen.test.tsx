jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { createElement } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ResultScreen } from '../ResultScreen';
import type { AuthenticatedStackParamList } from '../../navigation/AppNavigator';
import { createNavigationMock, pressByLabel, renderWithProviders, renderedText } from './renderHelpers';

type ResultParams = AuthenticatedStackParamList['Result'];

function renderResult(params: Partial<ResultParams> = {}) {
  const navigation = createNavigationMock();
  const route = {
    key: 'Result',
    name: 'Result',
    params: { score: 82, exerciseId: 'agachamento', referenceIsSynthetic: false, ...params },
  };
  return { navigation, element: createElement(ResultScreen, { navigation, route } as never) };
}

describe('ResultScreen', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('mostra a pontuação e o nome do exercício', async () => {
    const text = renderedText(await renderWithProviders(renderResult().element));

    expect(text).toContain('82');
    expect(text).toContain('Agachamento');
  });

  it('esconde o aviso experimental quando a referência é real', async () => {
    const text = renderedText(await renderWithProviders(renderResult({ referenceIsSynthetic: false }).element));

    expect(text).not.toContain('Pontuação experimental');
  });

  it('mostra o aviso experimental quando a referência é sintética', async () => {
    const text = renderedText(await renderWithProviders(renderResult({ referenceIsSynthetic: true }).element));

    expect(text).toContain('Pontuação experimental');
  });

  it('assume sintética quando o parâmetro está ausente', async () => {
    const { navigation } = renderResult();
    const route = { key: 'Result', name: 'Result', params: { score: 70, exerciseId: 'agachamento' } };
    const element = createElement(ResultScreen, { navigation, route } as never);

    expect(renderedText(await renderWithProviders(element))).toContain('Pontuação experimental');
  });

  it('anuncia recordes batidos', async () => {
    const text = renderedText(
      await renderWithProviders(renderResult({ newRecords: { score: true, weight: true } }).element)
    );

    expect(text).toContain('Novo recorde de pontuação!');
    expect(text).toContain('Novo recorde de carga!');
  });

  it('avisa sobre salto de carga', async () => {
    const text = renderedText(
      await renderWithProviders(
        renderResult({ overload: { averageRecentWeightKg: 50, increasePercent: 40 } }).element
      )
    );

    expect(text).toContain('40%');
    expect(text).toContain('progressão mais gradual');
  });

  it('avisa sobre fadiga só quando a forma degradou', async () => {
    const degraded = renderedText(
      await renderWithProviders(
        renderResult({ fatigue: { repCount: 8, consistencyPercent: 55, degraded: true } }).element
      )
    );
    const fine = renderedText(
      await renderWithProviders(
        renderResult({ fatigue: { repCount: 8, consistencyPercent: 95, degraded: false } }).element
      )
    );

    expect(degraded).toContain('possível sinal de fadiga');
    expect(fine).not.toContain('possível sinal de fadiga');
  });

  it('respeita a calibração corporal ao sinalizar assimetria', async () => {
    const asymmetry = { overallPercent: 18, byJoint: { elbow: 18, knee: 2, hip: 2 } };

    const withoutCalibration = renderedText(await renderWithProviders(renderResult({ asymmetry }).element));

    await AsyncStorage.setItem(
      '@gym_execution/body_calibration',
      JSON.stringify({ baselineAsymmetryPercent: 20 })
    );
    const withCalibration = renderedText(await renderWithProviders(renderResult({ asymmetry }).element));

    expect(withoutCalibration).toContain('Possível assimetria');
    expect(withCalibration).not.toContain('Possível assimetria');
  });

  it('volta ao início ao tocar no botão', async () => {
    const { navigation, element } = renderResult();
    const renderer = await renderWithProviders(element);

    await pressByLabel(renderer, 'Voltar ao início');

    expect(navigation.popToTop).toHaveBeenCalled();
  });
});
