import { useEffect, useMemo, useState } from 'react';
import { EXERCISES, type Exercise } from '../services/exerciseCatalog';
import { fetchExerciseCatalog, loadCachedCatalog } from '../services/exerciseCatalogService';

/**
 * Catálogo de exercícios pronto para renderizar, sem estado de loading:
 * começa no embutido, troca pelo cache local e depois pelo que o backend
 * responder. A tela nunca fica vazia e nunca trava esperando a rede — o
 * catálogo muda raramente, então mostrar o último conhecido é mais correto do
 * que um spinner.
 *
 * Falha de rede é ignorada de propósito: o app funciona offline (RNF05) e o
 * usuário não tem o que fazer com um erro sobre um catálogo que já está na tela.
 */
export function useExerciseCatalog(): { exercises: Exercise[] } {
  const [exercises, setExercises] = useState<Exercise[]>(EXERCISES);

  useEffect(() => {
    let active = true;
    const apply = (catalog: Exercise[]) => {
      if (active) setExercises(catalog);
    };

    loadCachedCatalog().then(apply).catch(() => {});
    fetchExerciseCatalog().then(apply).catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return { exercises };
}

/** Grupos musculares presentes no catálogo, para o filtro de `ExerciseListScreen`. */
export function useMuscleGroups(exercises: Exercise[]): string[] {
  return useMemo(
    () => Array.from(new Set(exercises.map((exercise) => exercise.muscleGroup))),
    [exercises]
  );
}
