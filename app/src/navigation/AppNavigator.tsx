import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { ExerciseListScreen } from '../screens/ExerciseListScreen';
import { ExecutionScreen } from '../screens/ExecutionScreen';
import { ResultScreen } from '../screens/ResultScreen';

export type RootStackParamList = {
  Home: undefined;
  ExerciseList: undefined;
  Execution: { exerciseId: string };
  Result: { score: number; exerciseId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Gym Execution' }} />
        <Stack.Screen name="ExerciseList" component={ExerciseListScreen} options={{ title: 'Exercícios' }} />
        <Stack.Screen name="Execution" component={ExecutionScreen} options={{ title: 'Execução' }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Resultado' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
