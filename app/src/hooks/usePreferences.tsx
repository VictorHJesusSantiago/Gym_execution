import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type Preferences,
} from '../services/preferencesStorage';
import { getTheme, type Theme } from '../services/theme';

type PreferencesContextValue = {
  preferences: Preferences;
  theme: Theme;
  updatePreferences: (partial: Partial<Preferences>) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Fonte única das preferências locais, no mesmo espírito do `AuthProvider`.
 *
 * Antes cada tela chamava `loadPreferences()` por conta própria (Execution,
 * Result e Settings faziam isso separadamente). Além de reler o AsyncStorage
 * várias vezes, isso tornava impossível uma preferência aplicar-se na hora:
 * mudar o tema em Configurações só teria efeito na próxima vez que outra tela
 * fosse montada. Com o estado no contexto, o toggle repinta o app inteiro
 * imediatamente.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    let active = true;
    loadPreferences().then((loaded) => {
      if (active) setPreferences(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  const updatePreferences = useCallback((partial: Partial<Preferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...partial };
      savePreferences(next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ preferences, theme: getTheme(preferences), updatePreferences }),
    [preferences, updatePreferences]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (context === null) throw new Error('usePreferences deve ser usado dentro de um PreferencesProvider');
  return context;
}

/** Atalho para telas que só precisam das cores. */
export function useTheme(): Theme {
  return usePreferences().theme;
}
