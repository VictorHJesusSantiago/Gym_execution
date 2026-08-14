import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './apiClient';
import { EXERCISES, type Exercise } from './exerciseCatalog';

type ExercisePublic = {
  id: string;
  name: string;
  muscle_group: string;
  description: string | null;
  reference_model_uri: string | null;
};

const STORAGE_KEY = '@gym_execution/exercise_catalog';

const CATALOG_PAGE_SIZE = 500;

export async function fetchExerciseCatalog(): Promise<Exercise[]> {
  const page = await apiRequest<ExercisePublic[]>(`/exercises?limit=${CATALOG_PAGE_SIZE}&offset=0`);
  const catalog = page.map(toExercise);

  if (catalog.length === 0) return loadCachedCatalog();

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(catalog)).catch(() => {});
  return catalog;
}

/** Último catálogo conhecido; cai no embutido se nunca houve um. */
export async function loadCachedCatalog(): Promise<Exercise[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return EXERCISES;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as Exercise[]) : EXERCISES;
  } catch {
    return EXERCISES;
  }
}

function toExercise(exercise: ExercisePublic): Exercise {
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscle_group,
    referenceModelUri: exercise.reference_model_uri ?? undefined,
  };
}
