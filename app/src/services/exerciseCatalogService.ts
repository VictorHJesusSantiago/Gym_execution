import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './apiClient';
import { EXERCISES, type Exercise } from './exerciseCatalog';

/** Espelha ExercisePublic em backend/app/schemas/exercise.py. */
type ExercisePublic = {
  id: string;
  name: string;
  muscle_group: string;
  description: string | null;
  reference_model_uri: string | null;
};

const STORAGE_KEY = '@gym_execution/exercise_catalog';

/** Igual ao teto do backend (`Query(le=500)` em routers/exercises.py). */
const CATALOG_PAGE_SIZE = 500;

/**
 * Catálogo vindo do backend, que é a fonte de verdade (RN02/DOM03: o catálogo é
 * global e seedado centralmente, não montado por cliente).
 *
 * O app mantinha uma lista fixa e NUNCA chamava `GET /exercises`, apesar de o
 * endpoint existir desde o início — por isso os ids divergiram do seed sem
 * ninguém notar. Buscar de verdade elimina a classe do problema: exercícios
 * publicados depois desta versão aparecem sozinhos, e o `reference_model_uri`
 * (que só o backend conhece) fica disponível para a etapa de download da
 * sequência de referência.
 *
 * Cache em AsyncStorage porque a lista muda raramente e o app precisa abrir
 * offline (RNF05).
 */
export async function fetchExerciseCatalog(): Promise<Exercise[]> {
  const page = await apiRequest<ExercisePublic[]>(`/exercises?limit=${CATALOG_PAGE_SIZE}&offset=0`);
  const catalog = page.map(toExercise);

  // Catálogo vazio significa banco sem seed aplicado — preservar o cache
  // anterior é melhor do que apagar a tela do usuário.
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
