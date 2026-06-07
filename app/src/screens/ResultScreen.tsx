import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export function ResultScreen({ route, navigation }: Props) {
  const { score, exerciseId } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Execução do exercício "{exerciseId}"</Text>
      <Text style={styles.score}>{score}%</Text>
      <Text style={styles.hint}>de acordo com o padrão de referência</Text>
      <Pressable style={styles.button} onPress={() => navigation.popToTop()}>
        <Text style={styles.buttonText}>Voltar ao início</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  label: { fontSize: 16, color: '#555' },
  score: { fontSize: 48, fontWeight: '800', color: '#2563eb' },
  hint: { fontSize: 14, color: '#94a3b8', marginBottom: 16 },
  button: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
