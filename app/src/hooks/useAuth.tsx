import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authService from '../services/authService';
import { clearToken, loadToken, saveToken } from '../services/authStorage';
import { setUnauthorizedHandler } from '../services/apiClient';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Fonte única do estado de sessão. Carrega o token persistido ao iniciar
 * (permitindo manter o usuário logado entre aberturas do app) e expõe
 * `signIn`/`signUp`/`signOut`, usados pelas telas de Login/Cadastro e
 * pelo restante do app para autorizar chamadas (`apiRequest(..., { token })`).
 *
 * Ver plano de navegação em README.md seção 2: `AppNavigator` decide
 * entre pilha pública/autenticada a partir de `status`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    loadToken().then((storedToken) => {
      setToken(storedToken);
      setStatus(storedToken ? 'signedIn' : 'signedOut');
    });
  }, []);

  async function forceSignOut() {
    await clearToken();
    setToken(null);
    setStatus('signedOut');
  }

  useEffect(() => {
    // Registra o handler global de 401 (ver apiClient.ts): uma chamada
    // autenticada rejeitada por token expirado/inválido encerra a sessão
    // local automaticamente, em vez de deixar a tela travada num erro.
    setUnauthorizedHandler(() => {
      forceSignOut().catch(() => {});
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  async function signIn(email: string, password: string) {
    const { access_token: accessToken } = await authService.login(email, password);
    await saveToken(accessToken);
    setToken(accessToken);
    setStatus('signedIn');
  }

  async function signUp(name: string, email: string, password: string) {
    await authService.register(name, email, password);
    await signIn(email, password);
  }

  async function signOut() {
    await forceSignOut();
  }

  const value = useMemo(() => ({ status, token, signIn, signUp, signOut }), [status, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
}
