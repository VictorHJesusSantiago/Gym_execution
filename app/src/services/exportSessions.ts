import type { TrainingSessionPublic } from './sessionsService';

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Gera o CSV do histórico para exportação (compartilhado via `Share` do
 * react-native — sem dependência nova). `exerciseName` resolve o id do
 * exercício para um nome legível (`exerciseCatalog`).
 */
export function sessionsToCSV(sessions: TrainingSessionPublic[], exerciseName: (exerciseId: string) => string): string {
  const header = 'Exercicio,Data,Pontuacao,Carga (kg)';
  const rows = sessions.map((session) =>
    [
      csvEscape(exerciseName(session.exercise_id)),
      session.executed_at,
      String(session.score),
      session.weight_kg != null ? String(session.weight_kg) : '',
    ].join(',')
  );
  return [header, ...rows].join('\n');
}
