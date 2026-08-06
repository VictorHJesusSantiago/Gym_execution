jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));

jest.mock('../../services/apiClient', () => ({ apiRequest: jest.fn() }));

import { createElement } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExerciseListScreen } from '../ExerciseListScreen';
import { apiRequest } from '../../services/apiClient';
import { EXERCISES } from '../../services/exerciseCatalog';
import { createNavigationMock, pressByLabel, renderWithProviders, renderedText } from './renderHelpers';

function renderList() {
  const navigation = createNavigationMock();
  const element = createElement(ExerciseListScreen, {
    navigation,
    route: { key: 'ExerciseList', name: 'ExerciseList' },
  } as never);
  return { navigation, element };
}

describe('ExerciseListScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (apiRequest as jest.Mock).mockReset().mockRejectedValue(new Error('offline'));
  });

  it('mostra o catálogo embutido mesmo sem rede', async () => {
    // RNF05: o app abre offline. Uma lista vazia enquanto a rede não responde
    // seria pior do que mostrar o catálogo que já vem no bundle.
    const text = renderedText(await renderWithProviders(renderList().element));

    expect(text).toContain('Agachamento');
    expect(text).toContain('Flexão de braço');
  });

  it('substitui pelo catálogo do backend quando ele responde', async () => {
    (apiRequest as jest.Mock).mockResolvedValue([
      {
        id: 'remada',
        name: 'Remada curvada',
        muscle_group: 'costas',
        description: null,
        reference_model_uri: null,
      },
    ]);

    const text = renderedText(await renderWithProviders(renderList().element));

    expect(text).toContain('Remada curvada');
    expect(text).toContain('costas');
  });

  it('monta o filtro de grupo muscular a partir do catálogo, sem duplicar', async () => {
    const text = renderedText(await renderWithProviders(renderList().element));
    const groups = new Set(EXERCISES.map((exercise) => exercise.muscleGroup));

    expect(text).toContain('Todos');
    for (const group of groups) {
      expect(text).toContain(group);
    }
  });

  it('abre a execução do exercício escolhido', async () => {
    const { navigation, element } = renderList();
    const renderer = await renderWithProviders(element);

    await pressByLabel(renderer, 'Iniciar Agachamento, pernas');

    expect(navigation.navigate).toHaveBeenCalledWith('Execution', { exerciseId: 'agachamento' });
  });

  it('marca favorito e o mostra na seção Favoritos na volta', async () => {
    const first = await renderWithProviders(renderList().element);
    await pressByLabel(first, 'Adicionar Agachamento aos favoritos');

    const stored = JSON.parse((await AsyncStorage.getItem('@gym_execution/favorite_exercises')) ?? '[]');
    expect(stored).toEqual(['agachamento']);

    const second = await renderWithProviders(renderList().element);
    expect(renderedText(second)).toContain('Favoritos');
  });

  it('desmarcar o favorito o remove do armazenamento', async () => {
    const renderer = await renderWithProviders(renderList().element);

    await pressByLabel(renderer, 'Adicionar Agachamento aos favoritos');
    await pressByLabel(renderer, 'Remover Agachamento dos favoritos');

    expect(JSON.parse((await AsyncStorage.getItem('@gym_execution/favorite_exercises')) ?? '[]')).toEqual([]);
  });

  it('registrar um exercício recente o coloca na seção Recentes', async () => {
    const renderer = await renderWithProviders(renderList().element);

    await pressByLabel(renderer, 'Iniciar Agachamento, pernas');

    const second = await renderWithProviders(renderList().element);
    expect(renderedText(second)).toContain('Recentes');
  });
});
