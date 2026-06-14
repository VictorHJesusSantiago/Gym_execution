import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
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
import type { AsymmetryResult, FatigueResult } from '../services/poseScoring';

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
  };
  History: undefined;
  Profile: undefined;
  Settings: undefined;
  Calibration: undefined;
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
      <AuthenticatedStack.Screen name="Home" component={HomeScreen} options={{ title: 'Gym Execution' }} />
      <AuthenticatedStack.Screen name="ExerciseList" component={ExerciseListScreen} options={{ title: 'Exercícios' }} />
      <AuthenticatedStack.Screen name="Execution" component={ExecutionScreen} options={{ title: 'Execução' }} />
      <AuthenticatedStack.Screen name="Result" component={ResultScreen} options={{ title: 'Resultado' }} />
      <AuthenticatedStack.Screen name="History" component={HistoryScreen} options={{ title: 'Histórico' }} />
      <AuthenticatedStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
      <AuthenticatedStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configurações' }} />
      <AuthenticatedStack.Screen name="Calibration" component={CalibrationScreen} options={{ title: 'Calibração' }} />
    </AuthenticatedStack.Navigator>
  );
}

/**
 * Alterna entre a pilha pública (Login/Cadastro) e a autenticada conforme
 * o estado de sessão de `useAuth` — ver README.md seção 2. Enquanto o
 * token persistido ainda está sendo carregado, mostra um loading simples
 * para evitar "piscar" a tela de login antes de saber se já há sessão.
 */
export function AppNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {status === 'signedIn' ? <AuthenticatedNavigator /> : <PublicNavigator />}
    </NavigationContainer>
  );
}
