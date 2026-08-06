jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { createElement } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeScreen } from '../HomeScreen';
import {
  accessibilityLabels,
  createNavigationMock,
  pressByLabel,
  renderWithProviders,
  renderedText,
} from './renderHelpers';

function renderHome() {
  const navigation = createNavigationMock();
  const element = createElement(HomeScreen, { navigation, route: { key: 'Home', name: 'Home' } } as never);
  return { navigation, element };
}

describe('HomeScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('monta e mostra os atalhos principais', async () => {
    const { element } = renderHome();

    const text = renderedText(await renderWithProviders(element));

    expect(text).toContain('Gym Execution');
    expect(text).toContain('Começar treino');
    expect(text).toContain('Ver histórico');
  });

  it('todo controle interativo tem papel de botão acessível', async () => {
    const { element } = renderHome();

    const renderer = await renderWithProviders(element);
    const buttons = renderer.root.findAll((node: ReactTestInstance) => node.props?.accessibilityRole === 'button', {
      deep: true,
    });

    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('navega para a lista de exercícios ao tocar em "Começar treino"', async () => {
    const { navigation, element } = renderHome();
    const renderer = await renderWithProviders(element);

    await pressByLabel(renderer, 'Começar treino');

    expect(navigation.navigate).toHaveBeenCalledWith('ExerciseList');
  });

  it('cada atalho leva à tela correspondente', async () => {
    const { navigation, element } = renderHome();
    const renderer = await renderWithProviders(element);

    await pressByLabel(renderer, 'Ver histórico de treinos');
    await pressByLabel(renderer, 'Abrir perfil');
    await pressByLabel(renderer, 'Abrir configurações');

    expect(navigation.navigate).toHaveBeenCalledWith('History');
    expect(navigation.navigate).toHaveBeenCalledWith('Profile');
    expect(navigation.navigate).toHaveBeenCalledWith('Settings');
  });

  it('aplica o tema escuro quando a preferência está ligada', async () => {
    // Regressão do interruptor que não fazia nada: aqui a preferência sai do
    // storage, passa pelo provider e chega ao estilo renderizado.
    await AsyncStorage.setItem('@gym_execution/preferences', JSON.stringify({ darkMode: true }));
    const { element } = renderHome();

    const renderer = await renderWithProviders(element);
    const root = renderer.toJSON() as { props: { style: Array<{ backgroundColor?: string }> } };

    expect(JSON.stringify(root.props.style)).toContain('#0f172a');
  });

  it('todo controle tocável tem rótulo acessível', async () => {
    // WCAG 2.1 "Nome, função, valor": um Pressable sem rótulo é anunciado como
    // um botão sem nome por TalkBack/VoiceOver.
    const { element } = renderHome();
    const renderer = await renderWithProviders(element);

    const pressables = renderer.root.findAll((node: ReactTestInstance) => typeof node.props?.onPress === 'function', {
      deep: true,
    });
    const unlabelled = pressables.filter((node: ReactTestInstance) => !node.props.accessibilityLabel);

    expect(unlabelled).toHaveLength(0);
    expect(accessibilityLabels(renderer)).toContain('Começar treino');
  });
});
