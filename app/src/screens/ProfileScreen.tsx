import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { getMyProfile, updateMyProfile } from '../services/userService';
import { listAllMySessions } from '../services/sessionsService';
import { ApiError } from '../services/apiClient';
import { computeProfileStats, type ProfileStats } from '../services/profileStats';
import type { UserPublic } from '../services/authService';

/**
 * Tela de Perfil (README.md): dados do usuário (GET/PUT /users/me),
 * estatísticas agregadas a partir do histórico (GET /sessions) e logout.
 */
export function ProfileScreen() {
  const { token, signOut } = useAuth();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ trainingCount: 0, averageScore: null });
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [profile, sessions] = await Promise.all([getMyProfile(token), listAllMySessions(token)]);
      setUser(profile);
      setName(profile.name);
      setStats(computeProfileStats(sessions.map((session) => session.score)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o perfil.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMyProfile(token, name.trim());
      setUser(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {editing ? (
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nome" />
      ) : (
        <Text style={styles.name}>{user.name}</Text>
      )}
      <Text style={styles.email}>{user.email}</Text>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.trainingCount}</Text>
          <Text style={styles.statLabel}>Treinos realizados</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.averageScore !== null ? `${stats.averageScore}%` : '—'}</Text>
          <Text style={styles.statLabel}>Pontuação média</Text>
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {editing ? (
        <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.button} onPress={() => setEditing(true)}>
          <Text style={styles.buttonText}>Editar perfil</Text>
        </Pressable>
      )}

      <Pressable style={styles.secondaryButton} onPress={signOut}>
        <Text style={styles.secondaryButtonText}>Sair</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 24, gap: 12, paddingTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 18, minWidth: 220, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  statBox: { alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 16, minWidth: 130 },
  statValue: { fontSize: 24, fontWeight: '700', color: '#2563eb' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
  error: { color: '#dc2626', fontSize: 14 },
  button: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8, marginTop: 8 },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#dc2626', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8 },
  secondaryButtonText: { color: '#dc2626', fontSize: 16, fontWeight: '600' },
});
