import { useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { countPendingSessions, drainPendingSessions } from '../services/pendingSessionsQueue';
import {
  listMySessions,
  SESSIONS_PAGE_SIZE,
  type TrainingSessionPublic,
} from '../services/sessionsService';
import { exerciseName } from '../services/exerciseCatalog';
import { ApiError } from '../services/apiClient';
import { useTheme } from '../hooks/usePreferences';

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
 * README.md seção 3 ("Reaproveita o mesmo padrão visual de lista").
 */
export function HistoryScreen() {
  const { token } = useAuth();
  const theme = useTheme();
  const [sessions, setSessions] = useState<TrainingSessionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  /** Recarrega do zero (primeira página) — usado no foco da tela e no pull-to-refresh. */
  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      // Reenvia resultados que falharam ao gravar (ex.: offline durante a
      // sessão, ver ExecutionScreen/pendingSessionsQueue) antes de carregar
      // o histórico, para que apareçam na lista já nesta visita.
      await drainPendingSessions(token).catch(() => {});
      setPendingCount(await countPendingSessions());
      const page = await listMySessions(token, { offset: 0 });
      setSessions(page);
      setHasMore(page.length === SESSIONS_PAGE_SIZE);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  /**
   * Busca a próxima página e acrescenta ao final — acionado por
   * `onEndReached` da FlatList (README.md seção 3, "lista paginada").
   */
  const loadMore = useCallback(async () => {
    if (!token || loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await listMySessions(token, { offset: sessions.length });
      setSessions((current) => [...current, ...page]);
      setHasMore(page.length === SESSIONS_PAGE_SIZE);
    } catch {
      // Falha ao carregar mais não substitui o erro principal — o usuário
      // já vê o histórico carregado até aqui e pode tentar rolar de novo.
    } finally {
      setLoadingMore(false);
    }
  }, [token, loading, loadingMore, hasMore, sessions.length]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      </View>
    );
  }

  const pendingBanner = pendingCount > 0 ? (
    <View style={styles.pendingBanner}>
      <Text style={styles.pendingText}>
        {pendingCount === 1
          ? '1 sessão ainda não foi sincronizada.'
          : `${pendingCount} sessões ainda não foram sincronizadas.`}{' '}
        Tentaremos novamente automaticamente.
      </Text>
    </View>
  ) : null;

  if (sessions.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {pendingBanner}
        <Text style={[styles.emptyText, { color: theme.muted }]}>Nenhum treino registrado ainda.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} accessibilityLabel="Histórico de treinos">
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={pendingBanner}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color={theme.primary} style={styles.footerSpinner} />
          ) : null
        }
        renderItem={({ item }) => (
          <View
            style={[styles.item, { backgroundColor: theme.surface }]}
            accessibilityLabel={`${exerciseName(item.exercise_id)}, ${item.score} por cento, ${formatDateTime(item.executed_at)}${item.weight_kg != null ? `, ${item.weight_kg} quilogramas` : ''}`}
          >
            <View style={styles.itemHeader}>
              <Text style={[styles.itemTitle, { color: theme.text }]}>{exerciseName(item.exercise_id)}</Text>
              <Text style={[styles.itemScore, { color: theme.accent }]}>{item.score}%</Text>
            </View>
            <Text style={[styles.itemSubtitle, { color: theme.muted }]}>
              {formatDateTime(item.executed_at)}
              {item.weight_kg != null ? ` · ${item.weight_kg} kg` : ''}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  item: { padding: 16, borderRadius: 8, marginBottom: 12 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 18, fontWeight: '600' },
  itemScore: { fontSize: 18, fontWeight: '700' },
  itemSubtitle: { fontSize: 14, marginTop: 4 },
  footerSpinner: { marginVertical: 16 },
  pendingBanner: { backgroundColor: '#fef3c7', borderRadius: 8, padding: 12, marginBottom: 12 },
  pendingText: { color: '#92400e', fontSize: 13, textAlign: 'center' },
  error: { fontSize: 16, textAlign: 'center' },
  emptyText: { fontSize: 16, textAlign: 'center' },
});
