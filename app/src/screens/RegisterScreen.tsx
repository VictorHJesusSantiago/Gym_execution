import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PublicStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/apiClient';
import { useTheme } from '../hooks/usePreferences';

type Props = NativeStackScreenProps<PublicStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await signUp(name.trim(), email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a conta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Criar conta</Text>

      <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        placeholderTextColor={theme.muted} placeholder="Nome" value={name} onChangeText={setName} />
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        placeholderTextColor={theme.muted}
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        placeholderTextColor={theme.muted}
        placeholder="Senha"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

      <Pressable style={[styles.button, { backgroundColor: submitting ? theme.disabled : theme.primary }]} onPress={handleSubmit} disabled={submitting}>
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{submitting ? 'Criando...' : 'Criar conta'}</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Login')}>
        <Text style={[styles.link, { color: theme.primary }]}>Já tem conta? Entrar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  error: { fontSize: 14 },
  button: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', marginTop: 16 },
});
