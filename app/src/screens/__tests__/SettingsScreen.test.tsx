jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { createElement } from 'react';
import { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsScreen } from '../SettingsScreen';
import { createNavigationMock, pressByLabel, renderWithProviders, renderedText } from './renderHelpers';

const STORAGE_KEY = '@gym_execution/preferences';

function renderSettings() {
  const navigation = createNavigationMock();
  const element = createElement(SettingsScreen, {
    navigation,
    route: { key: 'Settings', name: 'Settings' },
  } as never);
  return { navigation, element };
}

async function toggle(renderer: Awaited<ReturnType<typeof renderWithProviders>>, label: string, value: boolean) {
  const control = renderer.root.find(
    (node) => node.props?.accessibilityLabel === label && typeof node.props?.onValueChange === 'function'
  );
  await act(async () => {
    control.props.onValueChange(value);
  });
}

async function storedPreferences(): Promise<Record<string, unknown>> {
  return JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '{}');
}

describe('SettingsScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('mostra todas as preferências disponíveis', async () => {
    const text = renderedText(await renderWithProviders(renderSettings().element));

    expect(text).toContain('Qualidade da câmera');
    expect(text).toContain('Vibrar ao corrigir postura');
    expect(text).toContain('Modo escuro');
    expect(text).toContain('Alto contraste');
    expect(text).toContain('Fontes grandes');
  });

  it('persiste a qualidade da câmera escolhida', async () => {
    const renderer = await renderWithProviders(renderSettings().element);

    await pressByLabel(renderer, 'Qualidade da câmera: Economia. Para aparelhos mais antigos');

    expect((await storedPreferences()).cameraQuality).toBe('saver');
  });

  it('persiste o modo escuro e repinta a própria tela na hora', async () => {
    const renderer = await renderWithProviders(renderSettings().element);

    await toggle(renderer, 'Modo escuro', true);

    expect((await storedPreferences()).darkMode).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain('#0f172a');
  });

  it('avisa que alto contraste tem prioridade sobre o modo escuro', async () => {
    const renderer = await renderWithProviders(renderSettings().element);

    await toggle(renderer, 'Modo escuro', true);
    await toggle(renderer, 'Alto contraste', true);

    expect(renderedText(renderer)).toContain('Alto contraste tem prioridade');
  });

  it('não mostra o aviso de prioridade quando só um dos dois está ligado', async () => {
    const renderer = await renderWithProviders(renderSettings().element);

    await toggle(renderer, 'Alto contraste', true);

    expect(renderedText(renderer)).not.toContain('tem prioridade');
  });

  it('carrega o que já estava salvo', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ cameraQuality: 'high', largeText: true }));

    const text = renderedText(await renderWithProviders(renderSettings().element));

    expect(text).toContain('Mais precisão, mais bateria e memória');
  });

  it('leva às telas de calibração e metas', async () => {
    const { navigation, element } = renderSettings();
    const renderer = await renderWithProviders(element);

    await pressByLabel(renderer, 'Ajustar calibração corporal');
    await pressByLabel(renderer, 'Definir metas pessoais');

    expect(navigation.navigate).toHaveBeenCalledWith('Calibration');
    expect(navigation.navigate).toHaveBeenCalledWith('Goals');
  });
});
