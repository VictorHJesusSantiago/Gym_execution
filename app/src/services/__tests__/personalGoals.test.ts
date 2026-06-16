jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeGoalProgress, loadGoals, removeGoal, saveGoal, type PersonalGoal } from '../personalGoals';

const GOAL: PersonalGoal = { exerciseId: 'squat', targetScore: 90, targetWeightKg: 60 };

describe('personalGoals', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('retorna lista vazia quando nenhuma meta foi salva', async () => {
    expect(await loadGoals()).toEqual([]);
  });

  it('saveGoal adiciona uma meta nova', async () => {
    const goals = await saveGoal(GOAL);

    expect(goals).toEqual([GOAL]);
    expect(await loadGoals()).toEqual([GOAL]);
  });

  it('saveGoal substitui a meta existente do mesmo exercício', async () => {
    await saveGoal(GOAL);
    const updated: PersonalGoal = { exerciseId: 'squat', targetScore: 95, targetWeightKg: 70 };

    const goals = await saveGoal(updated);

    expect(goals).toEqual([updated]);
  });

  it('removeGoal remove apenas a meta do exercício indicado', async () => {
    await saveGoal(GOAL);
    await saveGoal({ exerciseId: 'pushup', targetScore: 80, targetWeightKg: null });

    const goals = await removeGoal('squat');

    expect(goals).toEqual([{ exerciseId: 'pushup', targetScore: 80, targetWeightKg: null }]);
  });

  it('retorna lista vazia quando o conteúdo salvo está corrompido', async () => {
    await AsyncStorage.setItem('@gym_execution/personal_goals', '{ json inválido');

    expect(await loadGoals()).toEqual([]);
  });
});

describe('computeGoalProgress', () => {
  it('retorna null quando não há meta', () => {
    expect(computeGoalProgress(null, { score: 90, weightKg: 60 })).toBeNull();
  });

  it('marca scoreReached quando a pontuação atinge a meta', () => {
    const progress = computeGoalProgress(GOAL, { score: 90, weightKg: 50 });

    expect(progress).toEqual({ scoreReached: true, weightReached: false });
  });

  it('marca weightReached quando a carga atinge a meta', () => {
    const progress = computeGoalProgress(GOAL, { score: 70, weightKg: 60 });

    expect(progress).toEqual({ scoreReached: false, weightReached: true });
  });

  it('não marca weightReached quando a carga da sessão é nula', () => {
    const progress = computeGoalProgress(GOAL, { score: 70, weightKg: null });

    expect(progress?.weightReached).toBe(false);
  });

  it('ignora metas não definidas (null)', () => {
    const goal: PersonalGoal = { exerciseId: 'squat', targetScore: null, targetWeightKg: null };

    const progress = computeGoalProgress(goal, { score: 100, weightKg: 100 });

    expect(progress).toEqual({ scoreReached: false, weightReached: false });
  });
});
