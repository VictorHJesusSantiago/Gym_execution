import type { NewRecords, OverloadWarning } from './sessionInsights';
import type { FatigueResult } from './poseScoring';

export type ResultShareInfo = {
  exerciseName: string;
  score: number;
  repCount?: number | null;
  weightKg?: number | null;
  newRecords?: NewRecords | null;
  overload?: OverloadWarning | null;
  fatigue?: FatigueResult | null;
};

/**
 * Resumo em texto do resultado da sessão, usado pelo botão "Compartilhar"
 * da ResultScreen (`Share.share` — mesmo padrão sem dependência nova do
 * `sessionsToCSV`).
 */
export function buildResultShareText(info: ResultShareInfo): string {
  const lines: string[] = [`${info.exerciseName}: ${info.score}% de pontuação`];

  if (info.repCount != null && info.repCount > 0) {
    lines.push(`Repetições: ${info.repCount}`);
  }
  if (info.weightKg != null) {
    lines.push(`Carga: ${info.weightKg}kg`);
  }
  if (info.newRecords?.score) {
    lines.push('Novo recorde de pontuação!');
  }
  if (info.newRecords?.weight) {
    lines.push('Novo recorde de carga!');
  }
  if (info.overload) {
    lines.push(`Atenção: carga ${info.overload.increasePercent}% acima da média recente.`);
  }
  if (info.fatigue?.degraded) {
    lines.push(`Possível sinal de fadiga (${info.fatigue.consistencyPercent}% de consistência).`);
  }

  lines.push('Registrado com o app Gym Execution.');
  return lines.join('\n');
}
