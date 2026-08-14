import { useEffect, useState } from 'react';
import type { PoseFrame } from '../services/poseTypes';
import { getReferenceFrames } from '../services/referenceLibrary';
import { useExerciseCatalog } from './useExerciseCatalog';

export type ReferenceState =
  | { status: 'loading' }
  | { status: 'ready'; frames: PoseFrame[]; isSynthetic: boolean };

/**
 * Carrega a sequência de referência do exercício, resolvendo o
 * `referenceModelUri` a partir do catálogo já cacheado.
 *
 * O diagrama de estados do README.md raiz sempre previu um passo
 * `LoadingReference` antes de `ModelReady` (e UC05 prevê "A2. Reference model
 * not cached → app blocks Start"); ele simplesmente nunca existiu no código —
 * a referência era gerada na hora, de forma síncrona e sintética.
 */
export function useReferenceSequence(exerciseId: string): ReferenceState {
  const { exercises } = useExerciseCatalog();
  const [state, setState] = useState<ReferenceState>({ status: 'loading' });

  const referenceModelUri = exercises.find((exercise) => exercise.id === exerciseId)?.referenceModelUri;

  useEffect(() => {
    let active = true;

    getReferenceFrames(exerciseId, referenceModelUri)
      .then((sequence) => {
        if (active) setState({ status: 'ready', ...sequence });
      })
      .catch(() => {
        if (active) setState({ status: 'ready', frames: [], isSynthetic: true });
      });

    return () => {
      active = false;
    };
  }, [exerciseId, referenceModelUri]);

  return state;
}
