import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authService from '../services/authService';
import {
  clearRefreshToken,
  clearToken,
  loadRefreshToken,
  loadToken,
  saveRefreshToken,
  saveToken,
} from '../services/authStorage';
import { setTokenRefreshHandler, setUnauthorizedHandler } from '../services/apiClient';

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
 * Fonte única do estado de sessão. Gerencia access + refresh tokens:
 * - Access token: vida curta (30 min), renovado silenciosamente via refresh.
 * - Refresh token: vida longa (30 dias), rotacionado a cada renovação.
 *
 * O `setTokenRefreshHandler` registra um callback no apiClient para que
 * qualquer chamada autenticada que receba 401 tente renovar o token antes
 * de acionar o logout — invisível para o usuário em uso normal.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadToken(), loadRefreshToken()]).then(([storedToken, storedRefresh]) => {
      setToken(storedToken);
      setRefreshToken(storedRefresh);
      setStatus(storedToken ? 'signedIn' : 'signedOut');
    });
  }, []);

  const forceSignOut = useCallback(async () => {
    await Promise.all([clearToken(), clearRefreshToken()]);
    setToken(null);
    setRefreshToken(null);
    setStatus('signedOut');
  }, []);

  const handleTokenRefresh = useCallback(async (): Promise<string | null> => {
    if (!refreshToken) return null;
    try {
      const { access_token, refresh_token: newRefresh } = await authService.refreshAccessToken(refreshToken);
      await Promise.all([saveToken(access_token), saveRefreshToken(newRefresh)]);
      setToken(access_token);
      setRefreshToken(newRefresh);
      return access_token;
    } catch {
      await forceSignOut();
      return null;
    }
  }, [refreshToken, forceSignOut]);

  useEffect(() => {
    setTokenRefreshHandler(handleTokenRefresh);
    return () => setTokenRefreshHandler(null);
  }, [handleTokenRefresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      forceSignOut().catch(() => {});
    });
    return () => setUnauthorizedHandler(null);
  }, [forceSignOut]);

  async function signIn(email: string, password: string) {
    const { access_token, refresh_token } = await authService.login(email, password);
    await Promise.all([saveToken(access_token), saveRefreshToken(refresh_token)]);
    setToken(access_token);
    setRefreshToken(refresh_token);
    setStatus('signedIn');
  }

  async function signUp(name: string, email: string, password: string) {
    await authService.register(name, email, password);
    await signIn(email, password);
  }

  async function signOut() {
    if (refreshToken) {
      // Melhor esforço: falha de rede não bloqueia o logout local.
      authService.logout(refreshToken).catch(() => {});
    }
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
