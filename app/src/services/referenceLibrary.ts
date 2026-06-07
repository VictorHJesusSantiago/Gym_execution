import { PoseFrame } from './poseTypes';

/**
 * Fonte das sequências de pose de referência por exercício.
 *
 * Em produção (ARCHITECTURE.md, seção 3): o backend distribui sequências
 * pré-processadas (extraídas de vídeos de referência gravados por
 * profissionais), cacheadas localmente para uso offline. Aqui, geramos
 * uma sequência sintética só para validar o algoritmo de scoring
 * ponta a ponta, sem depender ainda da API real.
 */
export function getReferenceFrames(_exerciseId: string): PoseFrame[] {
  const totalFrames = 30;
  return Array.from({ length: totalFrames }, (_, i) => {
    const t = i / totalFrames;
    const landmarks = Array.from({ length: 33 }, (_, index) => ({
      x: 0.5 + Math.sin(t * Math.PI * 2 + index) * 0.05,
      y: 0.5 + Math.cos(t * Math.PI * 2 + index) * 0.05,
      visibility: 1,
    }));
    return { timestampMs: i * 100, landmarks };
  });
}
