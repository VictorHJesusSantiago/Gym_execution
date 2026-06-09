import { useCallback, useRef, useState } from 'react';
import { PoseDetector, PoseFrame } from '../services/poseTypes';
import { scoreExecution } from '../services/poseScoring';

export type PoseSessionStatus = 'idle' | 'loading' | 'recording' | 'finished';

/**
 * Orquestra uma sessão de captura: carrega o detector, acumula os frames
 * de pose enquanto o usuário executa o exercício, e calcula o score final
 * comparando com a sequência de referência — tudo localmente.
 *
 * `detector` e `referenceFrames` são injetados de fora (inversão de
 * dependência), assim este hook não conhece a lib de CV concreta
 * (MediaPipe/TFLite) nem a origem dos dados de referência (cache local
 * baixado do backend, conforme README.md).
 */
export function usePoseSession(detector: PoseDetector, referenceFrames: PoseFrame[]) {
  const [status, setStatus] = useState<PoseSessionStatus>('idle');
  const [score, setScore] = useState<number | null>(null);
  const framesRef = useRef<PoseFrame[]>([]);

  const start = useCallback(async () => {
    setStatus('loading');
    framesRef.current = [];
    await detector.load();
    setStatus('recording');
  }, [detector]);

  /** Chamado a cada frame de câmera processado (ex: via onFrame do CameraView). */
  const captureFrame = useCallback(
    async (timestampMs: number) => {
      if (status !== 'recording') return;
      const frame = await detector.detect(timestampMs);
      if (frame) framesRef.current.push(frame);
    },
    [detector, status]
  );

  const finish = useCallback(() => {
    if (status !== 'recording') return;
    const finalScore = scoreExecution(framesRef.current, referenceFrames);
    setScore(finalScore);
    setStatus('finished');
    detector.dispose();
  }, [detector, referenceFrames, status]);

  return { status, score, start, captureFrame, finish };
}
