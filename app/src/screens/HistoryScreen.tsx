import { useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { listMySessions, type TrainingSessionPublic } from '../services/sessionsService';
import { EXERCISES } from '../services/exerciseCatalog';
import { ApiError } from '../services/apiClient';

function exerciseName(exerciseId: string): string {
  return EXERCISES.find((exercise) => exercise.id === exerciseId)?.name ?? exerciseId;
}

function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Lista o histórico de sessões do usuário (GET /sessions), reaproveitando
 * o mesmo padrão visual de `ExerciseListScreen` (FlatList + card) — ver
 * UX_PLAN.md seção 3 ("Reaproveita o mesmo padrão visual de lista").
 */
export function HistoryScreen() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<TrainingSessionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setSessions(await listMySessions(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Nenhum treino registrado ainda.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>{exerciseName(item.exercise_id)}</Text>
              <Text style={styles.itemScore}>{item.score}%</Text>
            </View>
            <Text style={styles.itemSubtitle}>{formatDateTime(item.executed_at)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  item: { padding: 16, borderRadius: 8, backgroundColor: '#f1f5f9', marginBottom: 12 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 18, fontWeight: '600' },
  itemScore: { fontSize: 18, fontWeight: '700', color: '#2563eb' },
  itemSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  error: { color: '#dc2626', fontSize: 16, textAlign: 'center' },
  emptyText: { color: '#64748b', fontSize: 16, textAlign: 'center' },
});
