import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = '@gym_execution/favorite_exercises';
const RECENTS_KEY = '@gym_execution/recent_exercises';

/** Quantos exercícios recentes ficam visíveis em `ExerciseListScreen`. */
const MAX_RECENTS = 5;

/**
 * Favoritos e recentes do catálogo de exercícios (ExerciseListScreen) —
 * preferências locais, sem relação com a conta (não fazem parte da API,
 * mesmo padrão de `preferencesStorage.ts`).
 */
export async function loadFavoriteExerciseIds(): Promise<string[]> {
  return loadIdList(FAVORITES_KEY);
}

/** Alterna o favorito e retorna a lista já atualizada. */
export async function toggleFavoriteExercise(exerciseId: string): Promise<string[]> {
  const favorites = await loadFavoriteExerciseIds();
  const next = favorites.includes(exerciseId)
    ? favorites.filter((id) => id !== exerciseId)
    : [...favorites, exerciseId];
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
}

export async function loadRecentExerciseIds(): Promise<string[]> {
  return loadIdList(RECENTS_KEY);
}

/** Marca `exerciseId` como o mais recente (move para o topo) e retorna a lista já atualizada. */
export async function recordRecentExercise(exerciseId: string): Promise<string[]> {
  const recents = await loadRecentExerciseIds();
  const next = [exerciseId, ...recents.filter((id) => id !== exerciseId)].slice(0, MAX_RECENTS);
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

async function loadIdList(key: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
