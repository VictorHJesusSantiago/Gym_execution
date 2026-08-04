import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/hooks/useAuth';
import { PreferencesProvider, useTheme } from './src/hooks/usePreferences';
import { AppNavigator } from './src/navigation/AppNavigator';

/** Separado para poder consumir o tema — precisa estar DENTRO do provider. */
function ThemedStatusBar() {
  const theme = useTheme();
  // Ícones claros sobre fundo escuro e vice-versa. Com `style="auto"` fixo, o
  // modo escuro deixava a barra de status ilegível.
  return <StatusBar style={theme.isDark ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <ThemedStatusBar />
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
