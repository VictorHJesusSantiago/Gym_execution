import { sessionsToCSV } from '../exportSessions';
import type { TrainingSessionPublic } from '../sessionsService';

function exerciseName(exerciseId: string): string {
  return exerciseId === 'squat' ? 'Agachamento, livre' : exerciseId;
}

describe('sessionsToCSV', () => {
  it('gera apenas o cabeçalho sem sessões', () => {
    expect(sessionsToCSV([], exerciseName)).toBe('Exercicio,Data,Pontuacao,Carga (kg)');
  });

  it('gera uma linha por sessão, com carga vazia quando nula', () => {
    const sessions: TrainingSessionPublic[] = [
      { id: '1', exercise_id: 'pushup', score: 80, executed_at: '2026-06-14T10:00:00.000Z', weight_kg: null },
      { id: '2', exercise_id: 'pushup', score: 90, executed_at: '2026-06-15T10:00:00.000Z', weight_kg: 20 },
    ];

    const csv = sessionsToCSV(sessions, exerciseName);

    expect(csv.split('\n')).toEqual([
      'Exercicio,Data,Pontuacao,Carga (kg)',
      'pushup,2026-06-14T10:00:00.000Z,80,',
      'pushup,2026-06-15T10:00:00.000Z,90,20',
    ]);
  });

  it('coloca entre aspas nomes de exercício com vírgula', () => {
    const sessions: TrainingSessionPublic[] = [
      { id: '1', exercise_id: 'squat', score: 80, executed_at: '2026-06-14T10:00:00.000Z', weight_kg: 50 },
    ];

    const csv = sessionsToCSV(sessions, exerciseName);

    expect(csv.split('\n')[1]).toBe('"Agachamento, livre",2026-06-14T10:00:00.000Z,80,50');
  });
});
