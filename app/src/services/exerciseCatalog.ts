export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  referenceModelUri?: string;
};

/**
 * Catálogo embutido — usado enquanto `GET /exercises` não respondeu (primeiro
 * abrir do app, modo offline) e como fallback se a API falhar.
 *
 * ⚠️ Os `id` DEVEM existir em `backend/alembic/versions/0002_seed_exercise_catalog.py`.
 * `exercise_id` é FK obrigatória em `training_sessions`: um id daqui que não
 * exista lá faz todo `POST /sessions` devolver 422, o histórico nunca receber
 * nada e cada resultado cair na fila offline que nunca drena. Foi exatamente o
 * que acontecia com os ids antigos (`squat`, `pushup`, `deadlift`,
 * `shoulder_press`), que jamais foram seedados.
 *
 * A verificação está automatizada em
 * `backend/tests/test_app_catalog_contract.py` — quebrar esta lista quebra o CI.
 *
 * A fonte de verdade é o backend; ver `exerciseCatalogService.ts`, que busca o
 * catálogo real e o mantém em cache.
 */
export const EXERCISES: Exercise[] = [
  { id: 'agachamento', name: 'Agachamento', muscleGroup: 'pernas' },
  { id: 'afundo', name: 'Afundo (lunge)', muscleGroup: 'pernas' },
  { id: 'flexao-de-braco', name: 'Flexão de braço', muscleGroup: 'peito' },
  { id: 'levantamento-terra', name: 'Levantamento terra', muscleGroup: 'posterior' },
  { id: 'prancha-abdominal', name: 'Prancha abdominal', muscleGroup: 'core' },
];

/**
 * Nome legível de um exercício, com o id cru como fallback (exercício novo,
 * publicado no backend depois desta versão do app).
 *
 * Estava duplicado literalmente em cinco telas (Execution, History, Profile,
 * Result, Goals); centralizado aqui para que um exercício adicionado passe a
 * aparecer com nome em todas de uma vez.
 */
export function exerciseName(exerciseId: string, catalog: Exercise[] = EXERCISES): string {
  return catalog.find((exercise) => exercise.id === exerciseId)?.name ?? exerciseId;
}
