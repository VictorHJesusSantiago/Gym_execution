import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { EXERCISES, type Exercise } from '../services/exerciseCatalog';
import {
  loadFavoriteExerciseIds,
  loadRecentExerciseIds,
  recordRecentExercise,
  toggleFavoriteExercise,
} from '../services/exercisePreferencesStorage';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'ExerciseList'>;

/** Opção do filtro que mostra todos os grupos musculares. */
const ALL_GROUPS = 'Todos';

const MUSCLE_GROUPS = [ALL_GROUPS, ...Array.from(new Set(EXERCISES.map((exercise) => exercise.muscleGroup)))];

export function ExerciseListScreen({ navigation }: Props) {
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
    selectedGroup === ALL_GROUPS ? EXERCISES : EXERCISES.filter((exercise) => exercise.muscleGroup === selectedGroup);

  const recentExercises = recentIds
    .map((id) => EXERCISES.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => !!exercise);

  const favoriteExercises = EXERCISES.filter((exercise) => favoriteIds.includes(exercise.id));

  function openExercise(exerciseId: string) {
    recordRecentExercise(exerciseId).then(setRecentIds);
    navigation.navigate('Execution', { exerciseId });
  }

  function handleToggleFavorite(exerciseId: string) {
    toggleFavoriteExercise(exerciseId).then(setFavoriteIds);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {recentExercises.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recentes</Text>
                <View style={styles.chipsRow}>
                  {recentExercises.map((exercise) => (
                    <Pressable key={exercise.id} style={styles.chip} onPress={() => openExercise(exercise.id)}>
                      <Text style={styles.chipText}>{exercise.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {favoriteExercises.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Favoritos</Text>
                <View style={styles.chipsRow}>
                  {favoriteExercises.map((exercise) => (
                    <Pressable key={exercise.id} style={styles.chip} onPress={() => openExercise(exercise.id)}>
                      <Text style={styles.chipText}>★ {exercise.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Grupo muscular</Text>
              <View style={styles.chipsRow}>
                {MUSCLE_GROUPS.map((group) => (
                  <Pressable
                    key={group}
                    style={[styles.chip, selectedGroup === group && styles.chipSelected]}
                    onPress={() => setSelectedGroup(group)}
                  >
                    <Text style={[styles.chipText, selectedGroup === group && styles.chipTextSelected]}>
                      {group}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Pressable style={styles.itemMain} onPress={() => openExercise(item.id)}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemSubtitle}>{item.muscleGroup}</Text>
            </Pressable>
            <Pressable
              onPress={() => handleToggleFavorite(item.id)}
              hitSlop={8}
              accessibilityLabel={favoriteIds.includes(item.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Text style={styles.favoriteIcon}>{favoriteIds.includes(item.id) ? '★' : '☆'}</Text>
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
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#e2e8f0' },
  chipSelected: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#334155' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginBottom: 12,
  },
  itemMain: { flex: 1 },
  itemTitle: { fontSize: 18, fontWeight: '600' },
  itemSubtitle: { fontSize: 14, color: '#64748b' },
  favoriteIcon: { fontSize: 24, color: '#f59e0b', paddingLeft: 12 },
});
