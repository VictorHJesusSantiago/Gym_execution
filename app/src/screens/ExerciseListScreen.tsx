import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { type Exercise } from '../services/exerciseCatalog';
import { useExerciseCatalog, useMuscleGroups } from '../hooks/useExerciseCatalog';
import { useTheme } from '../hooks/usePreferences';
import {
  loadFavoriteExerciseIds,
  loadRecentExerciseIds,
  recordRecentExercise,
  toggleFavoriteExercise,
} from '../services/exercisePreferencesStorage';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'ExerciseList'>;

/** Opção do filtro que mostra todos os grupos musculares. */
const ALL_GROUPS = 'Todos';

export function ExerciseListScreen({ navigation }: Props) {
  // Catálogo real do backend (com fallback embutido) em vez da lista fixa —
  // ver useExerciseCatalog/exerciseCatalogService.
  const theme = useTheme();
  const { exercises: catalog } = useExerciseCatalog();
  const muscleGroups = [ALL_GROUPS, ...useMuscleGroups(catalog)];

  const [selectedGroup, setSelectedGroup] = useState(ALL_GROUPS);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadFavoriteExerciseIds().then(setFavoriteIds);
      loadRecentExerciseIds().then(setRecentIds);
    }, [])
  );

  const exercises =
    selectedGroup === ALL_GROUPS ? catalog : catalog.filter((exercise) => exercise.muscleGroup === selectedGroup);

  const recentExercises = recentIds
    .map((id) => catalog.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => !!exercise);

  const favoriteExercises = catalog.filter((exercise) => favoriteIds.includes(exercise.id));

  function openExercise(exerciseId: string) {
    recordRecentExercise(exerciseId).then(setRecentIds);
    navigation.navigate('Execution', { exerciseId });
  }

  function handleToggleFavorite(exerciseId: string) {
    toggleFavoriteExercise(exerciseId).then(setFavoriteIds);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {recentExercises.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>Recentes</Text>
                <View style={styles.chipsRow}>
                  {recentExercises.map((exercise) => (
                    <Pressable key={exercise.id} style={[styles.chip, { backgroundColor: theme.surface }]} onPress={() => openExercise(exercise.id)}>
                      <Text style={[styles.chipText, { color: theme.text }]}>{exercise.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {favoriteExercises.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>Favoritos</Text>
                <View style={styles.chipsRow}>
                  {favoriteExercises.map((exercise) => (
                    <Pressable key={exercise.id} style={[styles.chip, { backgroundColor: theme.surface }]} onPress={() => openExercise(exercise.id)}>
                      <Text style={[styles.chipText, { color: theme.text }]}>★ {exercise.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.muted }]}>Grupo muscular</Text>
              <View style={styles.chipsRow}>
                {muscleGroups.map((group) => (
                  <Pressable
                    key={group}
                    style={[styles.chip, { backgroundColor: selectedGroup === group ? theme.primary : theme.surface }]}
                    onPress={() => setSelectedGroup(group)}
                  >
                    <Text style={[styles.chipText, { color: selectedGroup === group ? theme.onPrimary : theme.text }]}>
                      {group}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.item, { backgroundColor: theme.surface }]}>
            <Pressable
              style={styles.itemMain}
              onPress={() => openExercise(item.id)}
              accessibilityRole="button"
              // O rótulo inclui o grupo muscular porque um leitor de tela lê os
              // dois Text como nós separados, sem dizer que são do mesmo card.
              accessibilityLabel={`Iniciar ${item.name}, ${item.muscleGroup}`}
            >
              <Text style={[styles.itemTitle, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.itemSubtitle, { color: theme.muted }]}>{item.muscleGroup}</Text>
            </Pressable>
            <Pressable
              onPress={() => handleToggleFavorite(item.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                favoriteIds.includes(item.id)
                  ? `Remover ${item.name} dos favoritos`
                  : `Adicionar ${item.name} aos favoritos`
              }
            >
              <Text style={[styles.favoriteIcon, { color: theme.warning }]}>{favoriteIds.includes(item.id) ? '★' : '☆'}</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  chipText: { fontSize: 13 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemMain: { flex: 1 },
  itemTitle: { fontSize: 18, fontWeight: '600' },
  itemSubtitle: { fontSize: 14 },
  favoriteIcon: { fontSize: 24, paddingLeft: 12 },
});
