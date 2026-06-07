import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gym Execution</Text>
      <Text style={styles.subtitle}>Analise a execução dos seus exercícios com a câmera</Text>

      <Pressable style={styles.button} onPress={() => navigation.navigate('ExerciseList')}>
        <Text style={styles.buttonText}>Começar treino</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('History')}>
        <Text style={styles.secondaryButtonText}>Ver histórico</Text>
      </Pressable>

      <Pressable onPress={signOut}>
        <Text style={styles.link}>Sair</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#555' },
  button: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  secondaryButtonText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  link: { color: '#94a3b8', fontSize: 14, marginTop: 8 },
});
