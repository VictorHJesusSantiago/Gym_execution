import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Execution'>;

/**
 * Placeholder: aqui entrará a captura de câmera + inferência de pose
 * (MediaPipe/TensorFlow Lite) descrita em ARCHITECTURE.md, item 4.
 * Por ora, simula a conclusão de uma série e navega para o resultado.
 */
export function ExecutionScreen({ route, navigation }: Props) {
  const { exerciseId } = route.params;

  function handleFinish() {
    const mockScore = 0; // substituído pelo score real do módulo de CV
    navigation.replace('Result', { score: mockScore, exerciseId });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Câmera e análise de movimento (em construção)</Text>
      <Text style={styles.exerciseId}>Exercício: {exerciseId}</Text>
      <Pressable style={styles.button} onPress={handleFinish}>
        <Text style={styles.buttonText}>Finalizar série</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  text: { fontSize: 16, textAlign: 'center', color: '#555' },
  exerciseId: { fontSize: 14, color: '#94a3b8' },
  button: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
