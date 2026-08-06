import { createElement, type ReactElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PreferencesProvider } from '../../hooks/usePreferences';

/**
 * Utilitários de render das telas.
 *
 * As telas não tinham NENHUM teste de render — o que significa que um erro
 * simples (props obrigatória faltando, `undefined` desestruturado, texto
 * quebrado) só apareceria em execução manual. Estes testes não verificam
 * estética; verificam que a tela monta, mostra o conteúdo certo para cada
 * estado e respeita as preferências.
 */

/** Dublê de `navigation` do React Navigation — só o que as telas usam. */
export function createNavigationMock() {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
    popToTop: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  };
}

/** Monta a árvore dentro do PreferencesProvider e espera os efeitos assentarem. */
export async function renderWithProviders(element: ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(PreferencesProvider, null, element));
  });
  return renderer;
}

/**
 * Todo o texto renderizado, concatenado — evita depender da estrutura da árvore.
 *
 * Junta SEM separador: `Carga {percent}% acima` chega como três nós
 * (`"Carga "`, `40`, `"% acima"`) e um separador transformaria isso em
 * "40 %", que não é o que ninguém vê na tela — testes passariam a falhar por
 * um espaço que só existe no verificador.
 */
export function renderedText(renderer: ReactTestRenderer): string {
  const texts: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string' || typeof node === 'number') {
      texts.push(String(node));
    } else if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node && typeof node === 'object' && 'children' in node) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(renderer.toJSON());
  return texts.join('');
}

/** Nós com um `accessibilityLabel` — a superfície acessível da tela. */
export function accessibilityLabels(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAll((node) => Boolean(node.props?.accessibilityLabel), { deep: true })
    .map((node) => node.props.accessibilityLabel as string);
}

/**
 * Localiza um controle pelo rótulo acessível.
 *
 * De propósito NÃO procura por texto visível: buscar pelo mesmo atributo que um
 * leitor de tela usa faz o teste falhar quando o rótulo some — ou seja, a
 * acessibilidade passa a ser exigida pela suíte em vez de ficar torcendo para
 * alguém lembrar dela.
 */
export function pressByLabel(renderer: ReactTestRenderer, label: string): Promise<void> {
  const target = renderer.root.find(
    (node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function'
  );
  return act(async () => {
    target.props.onPress();
  });
}
