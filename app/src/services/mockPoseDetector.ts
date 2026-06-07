import { PoseDetector, PoseFrame } from './poseTypes';

/**
 * Detector simulado: gera landmarks com pequena variação aleatória,
 * permitindo testar o fluxo de captura → scoring → resultado sem
 * depender ainda da integração nativa com MediaPipe/TensorFlow Lite
 * (que requer build nativo e instalação de pacotes — passo futuro,
 * a ser feito com revisão cuidadosa de supply-chain).
 *
 * Substituir por um `MediaPipePoseDetector` real implementando a mesma
 * interface `PoseDetector`, sem tocar no restante do app.
 */
export class MockPoseDetector implements PoseDetector {
  private loaded = false;

  async load(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    this.loaded = true;
  }

  async detect(timestampMs: number): Promise<PoseFrame | null> {
    if (!this.loaded) return null;

    const totalLandmarks = 33; // padrão MediaPipe Pose — cobre todos os índices em LANDMARK_INDEX
    const landmarks = Array.from({ length: totalLandmarks }, (_, index) => ({
      x: 0.5 + Math.sin(timestampMs / 500 + index) * 0.05,
      y: 0.5 + Math.cos(timestampMs / 500 + index) * 0.05,
      visibility: 0.9,
    }));

    return { timestampMs, landmarks };
  }

  dispose(): void {
    this.loaded = false;
  }
}
