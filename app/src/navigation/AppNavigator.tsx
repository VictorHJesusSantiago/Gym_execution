import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/usePreferences';
import type { Theme } from '../services/theme';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ExerciseListScreen } from '../screens/ExerciseListScreen';
import { ExecutionScreen } from '../screens/ExecutionScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CalibrationScreen } from '../screens/CalibrationScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import type { AsymmetryResult, FatigueResult } from '../services/poseScoring';
import type { NewRecords, OverloadWarning } from '../services/sessionInsights';

export type PublicStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AuthenticatedStackParamList = {
  Home: undefined;
  ExerciseList: undefined;
  Execution: { exerciseId: string };
  Result: {
    score: number;
    exerciseId: string;
    asymmetry?: AsymmetryResult | null;
    repCount?: number | null;
    fatigue?: FatigueResult | null;
    newRecords?: NewRecords | null;
    overload?: OverloadWarning | null;
    weightKg?: number | null;
    /** A nota veio de uma referência sintética? Controla o aviso de
     * "pontuação experimental" — ver ADR-0001. */
    referenceIsSynthetic?: boolean;
  };
  History: undefined;
  Profile: undefined;
  Settings: undefined;
  Calibration: undefined;
  Goals: undefined;
};

const PublicStack = createNativeStackNavigator<PublicStackParamList>();
const AuthenticatedStack = createNativeStackNavigator<AuthenticatedStackParamList>();

function PublicNavigator() {
  return (
    <PublicStack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <PublicStack.Screen name="Login" component={LoginScreen} />
      <PublicStack.Screen name="Register" component={RegisterScreen} />
    </PublicStack.Navigator>
  );
}

function AuthenticatedNavigator() {
  return (
    <AuthenticatedStack.Navigator initialRouteName="Home">
      {/* Cores de cabeçalho vêm do `theme` do NavigationContainer. */}
      <AuthenticatedStack.Screen name="Home" component={HomeScreen} options={{ title: 'Gym Execution' }} />
      <AuthenticatedStack.Screen name="ExerciseList" component={ExerciseListScreen} options={{ title: 'Exercícios' }} />
      <AuthenticatedStack.Screen name="Execution" component={ExecutionScreen} options={{ title: 'Execução' }} />
      <AuthenticatedStack.Screen name="Result" component={ResultScreen} options={{ title: 'Resultado' }} />
      <AuthenticatedStack.Screen name="History" component={HistoryScreen} options={{ title: 'Histórico' }} />
      <AuthenticatedStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
      <AuthenticatedStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configurações' }} />
      <AuthenticatedStack.Screen name="Calibration" component={CalibrationScreen} options={{ title: 'Calibração' }} />
      <AuthenticatedStack.Screen name="Goals" component={GoalsScreen} options={{ title: 'Metas' }} />
    </AuthenticatedStack.Navigator>
  );
}

/**
 * Alterna entre a pilha pública (Login/Cadastro) e a autenticada conforme
 * o estado de sessão de `useAuth` — ver README.md seção 2. Enquanto o
 * token persistido ainda está sendo carregado, mostra um loading simples
 * para evitar "piscar" a tela de login antes de saber se já há sessão.
 */
/**
 * Converte o tema do app para o formato do React Navigation, para que os
 * cabeçalhos e o fundo das transições sigam a preferência de modo escuro —
 * sem isto, um app escuro ainda piscaria uma barra de título branca a cada
 * navegação.
 */
function toNavigationTheme(theme: Theme): NavigationTheme {
  return {
    ...DefaultTheme,
    dark: theme.isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      notification: theme.danger,
    },
  };
}

export function AppNavigator() {
  const { status } = useAuth();
  const theme = useTheme();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={toNavigationTheme(theme)}>
      {status === 'signedIn' ? <AuthenticatedNavigator /> : <PublicNavigator />}
    </NavigationContainer>
  );
}
