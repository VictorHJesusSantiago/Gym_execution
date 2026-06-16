import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@gym_execution/personal_goals';

export type PersonalGoal = {
  exerciseId: string;
  targetScore: number | null;
  targetWeightKg: number | null;
};

/** Metas pessoais por exercício, persistidas localmente (mesmo padrão de `bodyCalibration`). */
export async function loadGoals(): Promise<PersonalGoal[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PersonalGoal[];
  } catch {
    return [];
  }
}

/** Salva (ou substitui) a meta de um exercício. */
export async function saveGoal(goal: PersonalGoal): Promise<PersonalGoal[]> {
  const goals = await loadGoals();
  const next = [...goals.filter((existing) => existing.exerciseId !== goal.exerciseId), goal];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function removeGoal(exerciseId: string): Promise<PersonalGoal[]> {
  const goals = await loadGoals();
  const next = goals.filter((existing) => existing.exerciseId !== exerciseId);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export type GoalProgress = {
  scoreReached: boolean;
  weightReached: boolean;
};

/** Compara o resultado de uma sessão com a meta definida para o exercício. */
export function computeGoalProgress(
  goal: PersonalGoal | null | undefined,
  current: { score: number; weightKg: number | null }
): GoalProgress | null {
  if (!goal) return null;
  return {
    scoreReached: goal.targetScore != null && current.score >= goal.targetScore,
    weightReached:
      goal.targetWeightKg != null && current.weightKg != null && current.weightKg >= goal.targetWeightKg,
  };
}
