/** Dicas curtas de aquecimento por exercício, exibidas antes de iniciar a gravação. */
const WARMUP_TIPS: Record<string, string> = {
  squat: 'Aquecimento: 10 agachamentos livres + mobilidade de quadril e tornozelo.',
  pushup: 'Aquecimento: rotação de ombros + flexões com joelhos apoiados no chão.',
  deadlift: 'Aquecimento: mobilidade de quadril/posterior + levantamento terra com carga leve.',
  shoulder_press: 'Aquecimento: rotação e elevação leve dos braços para aquecer os ombros.',
};

const DEFAULT_WARMUP_TIP = 'Aquecimento: faça alguns minutos de movimento leve antes de começar.';

export function getWarmupTip(exerciseId: string): string {
  return WARMUP_TIPS[exerciseId] ?? DEFAULT_WARMUP_TIP;
}
