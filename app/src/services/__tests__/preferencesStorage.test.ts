// Mock oficial do AsyncStorage para testes (documentado pelo próprio pacote
// @react-native-async-storage/async-storage) — guarda os dados em memória,
// sem precisar de um ambiente nativo.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadPreferences, savePreferences, DEFAULT_PREFERENCES } from '../preferencesStorage';

describe('preferencesStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('retorna os valores padrão quando nada foi salvo ainda', async () => {
    const preferences = await loadPreferences();

    expect(preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('persiste e recarrega as preferências salvas', async () => {
    const preferences = {
      cameraQuality: 'saver' as const,
      vibrationFeedback: false,
      darkMode: true,
      colorBlindMode: true,
      highContrast: true,
      largeText: true,
    };
    await savePreferences(preferences);

    const reloaded = await loadPreferences();

    expect(reloaded).toEqual(preferences);
  });

  it('migra o antigo `soundFeedback` para `vibrationFeedback`', async () => {
    // Quem já tinha desligado o feedback não pode vê-lo voltar sozinho ao
    // padrão só porque a chave foi renomeada.
    await AsyncStorage.setItem(
      '@gym_execution/preferences',
      JSON.stringify({ ...DEFAULT_PREFERENCES, soundFeedback: false, vibrationFeedback: undefined })
    );

    const preferences = await loadPreferences();

    expect(preferences.vibrationFeedback).toBe(false);
    expect(preferences).not.toHaveProperty('soundFeedback');
  });

  it('a chave nova vence a antiga quando as duas existem', async () => {
    await AsyncStorage.setItem(
      '@gym_execution/preferences',
      JSON.stringify({ soundFeedback: false, vibrationFeedback: true })
    );

    expect((await loadPreferences()).vibrationFeedback).toBe(true);
  });

  it('preenche campos ausentes com os padrões ao ler dados salvos parcialmente', async () => {
    await AsyncStorage.setItem('@gym_execution/preferences', JSON.stringify({ darkMode: true }));

    const preferences = await loadPreferences();

    expect(preferences).toEqual({ ...DEFAULT_PREFERENCES, darkMode: true });
  });

  it('retorna os valores padrão quando o conteúdo salvo está corrompido', async () => {
    await AsyncStorage.setItem('@gym_execution/preferences', '{ json inválido');

    const preferences = await loadPreferences();

    expect(preferences).toEqual(DEFAULT_PREFERENCES);
  });
});
