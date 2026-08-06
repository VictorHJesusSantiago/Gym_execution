import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../hooks/usePreferences';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Gym Execution</Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Analise a execução dos seus exercícios com a câmera
      </Text>

      <Pressable
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate('ExerciseList')}
        accessibilityRole="button"
        accessibilityLabel="Começar treino"
      >
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Começar treino</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, { borderColor: theme.primary }]}
        onPress={() => navigation.navigate('History')}
        accessibilityRole="button"
        accessibilityLabel="Ver histórico de treinos"
      >
        <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Ver histórico</Text>
      </Pressable>

      <View style={styles.linkRow}>
        <Pressable
          onPress={() => navigation.navigate('Profile')}
          accessibilityRole="button"
          accessibilityLabel="Abrir perfil"
        >
          <Text style={[styles.link, { color: theme.muted }]}>Perfil</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Abrir configurações"
        >
          <Text style={[styles.link, { color: theme.muted }]}>Configurações</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 16, textAlign: 'center' },
  button: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  secondaryButton: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
  linkRow: { flexDirection: 'row', gap: 24, marginTop: 8 },
  link: { fontSize: 14 },
});
