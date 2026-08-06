/**
 * Dicas curtas de aquecimento por exercício, exibidas antes de iniciar a gravação.
 *
 * As chaves são os `id` do catálogo — ver `exerciseCatalog.ts` e o seed em
 * `backend/alembic/versions/0002_seed_exercise_catalog.py`. Com os ids antigos
 * (`squat`, `pushup`, ...) nenhuma chave casava e todo exercício caía no texto
 * genérico, sem nada indicar a falha.
 */
const WARMUP_TIPS: Record<string, string> = {
  agachamento: 'Aquecimento: 10 agachamentos livres + mobilidade de quadril e tornozelo.',
  afundo: 'Aquecimento: mobilidade de quadril + 10 afundos sem carga, alternando as pernas.',
  'flexao-de-braco': 'Aquecimento: rotação de ombros + flexões com joelhos apoiados no chão.',
  'levantamento-terra': 'Aquecimento: mobilidade de quadril/posterior + levantamento terra com carga leve.',
  'prancha-abdominal': 'Aquecimento: ative o core com 2 séries curtas de prancha (15s) antes da série valendo.',
};

const DEFAULT_WARMUP_TIP = 'Aquecimento: faça alguns minutos de movimento leve antes de começar.';

export function getWarmupTip(exerciseId: string): string {
  return WARMUP_TIPS[exerciseId] ?? DEFAULT_WARMUP_TIP;
}
