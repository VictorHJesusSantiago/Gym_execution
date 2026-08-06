jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// O prefixo `mock` é obrigatório: a fábrica do `jest.mock` é içada para antes
// das declarações do módulo, e o Babel só libera acesso a variáveis externas
// que sigam essa convenção — sem ela, a fábrica poderia ler um `undefined`.
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
    signOut: jest.fn(),
    status: 'signedOut',
    token: null,
  }),
}));

import { createElement } from 'react';
import { act } from 'react-test-renderer';
import { LoginScreen } from '../LoginScreen';
import { RegisterScreen } from '../RegisterScreen';
import { ApiError } from '../../services/apiClient';
import { createNavigationMock, renderWithProviders, renderedText } from './renderHelpers';

/**
 * `LoginScreen` e `RegisterScreen` declaram `Props` com nomes iguais mas tipos
 * distintos (rotas diferentes); uni-los num parâmetro faz o TS rejeitar o
 * `createElement`. Uma função por tela é mais simples do que forçar a união.
 */
function renderLogin() {
  const navigation = createNavigationMock();
  return { navigation, element: createElement(LoginScreen, { navigation, route: { key: 'Login', name: 'Login' } } as never) };
}

function renderRegister() {
  const navigation = createNavigationMock();
  return { navigation, element: createElement(RegisterScreen, { navigation, route: { key: 'Register', name: 'Register' } } as never) };
}

/** Preenche um campo pelo placeholder — é o que identifica o input na tela. */
async function type(
  renderer: Awaited<ReturnType<typeof renderWithProviders>>,
  placeholder: string,
  value: string
) {
  const input = renderer.root.find((node: import('react-test-renderer').ReactTestInstance) => node.props?.placeholder === placeholder);
  await act(async () => {
    input.props.onChangeText(value);
  });
}

async function press(renderer: Awaited<ReturnType<typeof renderWithProviders>>, text: string) {
  const button = renderer.root.find(
    (node: import('react-test-renderer').ReactTestInstance) =>
      typeof node.props?.onPress === 'function' && node.props?.children?.props?.children === text
  );
  await act(async () => {
    button.props.onPress();
  });
}

describe('LoginScreen', () => {
  beforeEach(() => {
    mockSignIn.mockReset().mockResolvedValue(undefined);
    mockSignUp.mockReset().mockResolvedValue(undefined);
  });

  it('monta com os campos de e-mail e senha', async () => {
    const text = renderedText(await renderWithProviders(renderLogin().element));

    expect(text).toContain('Gym Execution');
    expect(text).toContain('Entrar');
  });

  it('autentica com o e-mail sem espaços em volta', async () => {
    // `email.trim()` importa: teclado de celular adiciona espaço com frequência
    // e o backend compara o e-mail literalmente.
    const renderer = await renderWithProviders(renderLogin().element);

    await type(renderer, 'E-mail', '  ana@example.com  ');
    await type(renderer, 'Senha', 'senha-forte-123');
    await press(renderer, 'Entrar');

    expect(mockSignIn).toHaveBeenCalledWith('ana@example.com', 'senha-forte-123');
  });

  it('mostra a mensagem do backend quando as credenciais falham', async () => {
    mockSignIn.mockRejectedValue(new ApiError(401, 'Credenciais inválidas'));
    const renderer = await renderWithProviders(renderLogin().element);

    await type(renderer, 'E-mail', 'ana@example.com');
    await press(renderer, 'Entrar');

    expect(renderedText(renderer)).toContain('Credenciais inválidas');
  });

  it('usa mensagem genérica quando o erro não vem da API', async () => {
    mockSignIn.mockRejectedValue(new Error('rede caiu'));
    const renderer = await renderWithProviders(renderLogin().element);

    await press(renderer, 'Entrar');

    expect(renderedText(renderer)).toContain('Não foi possível entrar');
  });

  it('a senha nunca é renderizada em texto visível', async () => {
    const renderer = await renderWithProviders(renderLogin().element);

    await type(renderer, 'Senha', 'senha-secreta');
    const passwordInput = renderer.root.find((node) => node.props?.placeholder === 'Senha');

    expect(passwordInput.props.secureTextEntry).toBe(true);
  });

  it('leva à tela de cadastro', async () => {
    const { navigation, element } = renderLogin();
    const renderer = await renderWithProviders(element);

    await press(renderer, 'Não tem conta? Criar conta');

    expect(navigation.navigate).toHaveBeenCalledWith('Register');
  });
});

describe('RegisterScreen', () => {
  beforeEach(() => {
    mockSignUp.mockReset().mockResolvedValue(undefined);
  });

  it('cadastra com nome, e-mail e senha', async () => {
    const renderer = await renderWithProviders(renderRegister().element);

    await type(renderer, 'Nome', ' Ana ');
    await type(renderer, 'E-mail', ' ana@example.com ');
    await type(renderer, 'Senha', 'senha-forte-123');
    await press(renderer, 'Criar conta');

    expect(mockSignUp).toHaveBeenCalledWith('Ana', 'ana@example.com', 'senha-forte-123');
  });

  it('mostra o erro de e-mail já cadastrado', async () => {
    mockSignUp.mockRejectedValue(new ApiError(409, 'E-mail já cadastrado'));
    const renderer = await renderWithProviders(renderRegister().element);

    await press(renderer, 'Criar conta');

    expect(renderedText(renderer)).toContain('E-mail já cadastrado');
  });

  it('volta para o login', async () => {
    const { navigation, element } = renderRegister();
    const renderer = await renderWithProviders(element);

    await press(renderer, 'Já tem conta? Entrar');

    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });
});
