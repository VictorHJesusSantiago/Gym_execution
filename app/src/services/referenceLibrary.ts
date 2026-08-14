import AsyncStorage from '@react-native-async-storage/async-storage';
import { PoseFrame } from './poseTypes';

/**
 * Fonte das sequências de pose de referência por exercício.
 *
 * Em produção (README.md, seção 3): o backend publica sequências
 * pré-processadas — extraídas de vídeos gravados por profissionais pelo
 * pipeline offline — no storage de mídia, e expõe a URL em
 * `exercises.reference_model_uri`. O app baixa, guarda em cache local e
 * compara a execução do usuário contra ela.
 *
 * ⚠️ Enquanto nenhuma sequência real tiver sido publicada, `getReferenceFrames`
 * devolve `isSynthetic: true` e uma sequência gerada por seno/cosseno, que NÃO
 * representa o movimento de exercício algum. Quem consome DEVE respeitar essa
 * flag e avisar o usuário — ver
 * docs/adr/0001-reference-pose-sequences-are-synthetic.md.
 */

export type ReferenceSequence = {
  frames: PoseFrame[];
  /** `true` = a pontuação resultante não tem significado clínico. */
  isSynthetic: boolean;
};

/** Envelope produzido por `backend/pipeline/pose_sequence_format.py`. */
type PublishedSequence = {
  exerciseId: string;
  landmarkFormat: string;
  frames: Array<{ timestampMs: number; landmarks: Array<{ x: number; y: number; visibility: number }> }>;
};

/** O único formato que `poseScoring`/`LANDMARK_INDEX` sabem interpretar. */
const SUPPORTED_LANDMARK_FORMAT = 'mediapipe-pose-33';

const CACHE_PREFIX = '@gym_execution/reference/';
const DOWNLOAD_TIMEOUT_MS = 20_000;

/**
 * Sequência de referência do exercício, do cache ou da rede.
 *
 * Sem `referenceModelUri` (exercício ainda sem referência publicada) devolve a
 * sintética, explicitamente marcada.
 */
export async function getReferenceFrames(
  exerciseId: string,
  referenceModelUri?: string
): Promise<ReferenceSequence> {
  if (!referenceModelUri) return syntheticSequence();

  const cached = await loadCachedSequence(exerciseId);
  if (cached) return { frames: cached, isSynthetic: false };

  try {
    const frames = await downloadSequence(exerciseId, referenceModelUri);
    await AsyncStorage.setItem(cacheKey(exerciseId), JSON.stringify(frames)).catch(() => {});
    return { frames, isSynthetic: false };
  } catch (error) {
    console.warn('[referenceLibrary] falha ao baixar a sequência de referência', error);
    return syntheticSequence();
  }
}

async function downloadSequence(exerciseId: string, uri: string): Promise<PoseFrame[]> {
  const response = await fetch(uri, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ao baixar ${uri}`);

  const payload = (await response.json()) as PublishedSequence;

  if (payload.landmarkFormat !== SUPPORTED_LANDMARK_FORMAT) {
    throw new Error(`formato de landmark não suportado: ${payload.landmarkFormat}`);
  }
  if (payload.exerciseId !== exerciseId) {
    throw new Error(`sequência é de '${payload.exerciseId}', esperado '${exerciseId}'`);
  }
  if (!Array.isArray(payload.frames) || payload.frames.length === 0) {
    throw new Error('sequência sem frames');
  }

  return payload.frames.map(toPoseFrame);
}

function toPoseFrame(frame: PublishedSequence['frames'][number]): PoseFrame {
  return {
    timestampMs: frame.timestampMs,
    landmarks: frame.landmarks.map((landmark) => ({
      x: landmark.x,
      y: landmark.y,
      visibility: landmark.visibility,
    })),
  };
}

async function loadCachedSequence(exerciseId: string): Promise<PoseFrame[] | null> {
  const raw = await AsyncStorage.getItem(cacheKey(exerciseId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as PoseFrame[]) : null;
  } catch {
    return null;
  }
}

/** Descarta o cache de um exercício — usar quando `reference_model_uri` mudar. */
export async function clearCachedSequence(exerciseId: string): Promise<void> {
  await AsyncStorage.removeItem(cacheKey(exerciseId));
}

function cacheKey(exerciseId: string): string {
  return `${CACHE_PREFIX}${exerciseId}`;
}

const SYNTHETIC_FRAME_COUNT = 30;
const MEDIAPIPE_LANDMARK_COUNT = 33;

/**
 * Figura de Lissajous, não um movimento. Existe só para o fluxo
 * captura → scoring → resultado rodar de ponta a ponta antes de haver vídeos
 * de referência gravados.
 */
function syntheticSequence(): ReferenceSequence {
  const frames = Array.from({ length: SYNTHETIC_FRAME_COUNT }, (_, i) => {
    const t = i / SYNTHETIC_FRAME_COUNT;
    const landmarks = Array.from({ length: MEDIAPIPE_LANDMARK_COUNT }, (_, index) => ({
      x: 0.5 + Math.sin(t * Math.PI * 2 + index) * 0.05,
      y: 0.5 + Math.cos(t * Math.PI * 2 + index) * 0.05,
      visibility: 1,
    }));
    return { timestampMs: i * 100, landmarks };
  });

  return { frames, isSynthetic: true };
}
