import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadFavoriteExerciseIds,
  loadRecentExerciseIds,
  recordRecentExercise,
  toggleFavoriteExercise,
} from '../exercisePreferencesStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('exercisePreferencesStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('retorna listas vazias quando nada foi salvo', async () => {
    expect(await loadFavoriteExerciseIds()).toEqual([]);
    expect(await loadRecentExerciseIds()).toEqual([]);
  });

  it('toggleFavoriteExercise adiciona e remove um favorito', async () => {
    expect(await toggleFavoriteExercise('squat')).toEqual(['squat']);
    expect(await loadFavoriteExerciseIds()).toEqual(['squat']);

    expect(await toggleFavoriteExercise('squat')).toEqual([]);
    expect(await loadFavoriteExerciseIds()).toEqual([]);
  });

  it('toggleFavoriteExercise preserva múltiplos favoritos', async () => {
    await toggleFavoriteExercise('squat');
    await toggleFavoriteExercise('pushup');

    expect(await loadFavoriteExerciseIds()).toEqual(['squat', 'pushup']);
  });

  it('recordRecentExercise coloca o exercício mais recente no topo', async () => {
    await recordRecentExercise('squat');
    await recordRecentExercise('pushup');
    await recordRecentExercise('squat');

    expect(await loadRecentExerciseIds()).toEqual(['squat', 'pushup']);
  });

  it('recordRecentExercise limita a lista aos 5 mais recentes', async () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      await recordRecentExercise(id);
    }

    expect(await loadRecentExerciseIds()).toEqual(['f', 'e', 'd', 'c', 'b']);
  });

  it('ignora dados corrompidos e retorna lista vazia', async () => {
    await AsyncStorage.setItem('@gym_execution/favorite_exercises', '{not valid json');

    expect(await loadFavoriteExerciseIds()).toEqual([]);
  });
});
