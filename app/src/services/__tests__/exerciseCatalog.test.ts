jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../apiClient', () => ({
  apiRequest: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../apiClient';
import { EXERCISES, exerciseName } from '../exerciseCatalog';
import { fetchExerciseCatalog, loadCachedCatalog } from '../exerciseCatalogService';

/**
 * Ids seedados por `backend/alembic/versions/0002_seed_exercise_catalog.py`.
 * A verificação viva mora do lado do backend
 * (`tests/test_app_catalog_contract.py`, que lê o .ts de verdade); esta cópia
 * garante que o app sozinho também falhe se alguém mexer no catálogo embutido
 * sem rodar a suíte Python.
 */
const SEEDED_IDS = [
  'agachamento',
  'afundo',
  'flexao-de-braco',
  'levantamento-terra',
  'prancha-abdominal',
];

describe('exerciseCatalog (embutido)', () => {
  it('só contém ids que existem no seed do backend', () => {
    expect(EXERCISES.map((exercise) => exercise.id).sort()).toEqual([...SEEDED_IDS].sort());
  });

  it('exerciseName resolve o nome e cai no id cru para exercício desconhecido', () => {
    expect(exerciseName('agachamento')).toBe('Agachamento');
    expect(exerciseName('exercicio-novo-do-servidor')).toBe('exercicio-novo-do-servidor');
  });

  it('exerciseName aceita um catálogo alternativo (o que veio do backend)', () => {
    const remote = [{ id: 'remada', name: 'Remada curvada', muscleGroup: 'costas' }];

    expect(exerciseName('remada', remote)).toBe('Remada curvada');
  });
});

describe('exerciseCatalogService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (apiRequest as jest.Mock).mockReset();
  });

  it('busca o catálogo no backend e converte snake_case para o formato do app', async () => {
    (apiRequest as jest.Mock).mockResolvedValue([
      {
        id: 'remada',
        name: 'Remada curvada',
        muscle_group: 'costas',
        description: null,
        reference_model_uri: 'https://cdn.example.com/remada.json',
      },
    ]);

    const catalog = await fetchExerciseCatalog();

    expect(catalog).toEqual([
      {
        id: 'remada',
        name: 'Remada curvada',
        muscleGroup: 'costas',
        referenceModelUri: 'https://cdn.example.com/remada.json',
      },
    ]);
  });

  it('guarda em cache o que veio do backend, para abrir offline', async () => {
    (apiRequest as jest.Mock).mockResolvedValue([
      { id: 'remada', name: 'Remada curvada', muscle_group: 'costas', description: null, reference_model_uri: null },
    ]);

    await fetchExerciseCatalog();

    expect(await loadCachedCatalog()).toEqual([
      { id: 'remada', name: 'Remada curvada', muscleGroup: 'costas', referenceModelUri: undefined },
    ]);
  });

  it('sem cache, cai no catálogo embutido em vez de devolver lista vazia', async () => {
    expect(await loadCachedCatalog()).toEqual(EXERCISES);
  });

  it('catálogo vazio do backend (banco sem seed) não apaga o que o app já tinha', async () => {
    (apiRequest as jest.Mock).mockResolvedValue([]);

    expect(await fetchExerciseCatalog()).toEqual(EXERCISES);
  });
});
