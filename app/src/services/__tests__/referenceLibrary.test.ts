jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearCachedSequence, getReferenceFrames } from '../referenceLibrary';

/** Envelope produzido por `backend/pipeline/pose_sequence_format.py`. */
function publishedSequence(exerciseId = 'agachamento') {
  return {
    exerciseId,
    landmarkFormat: 'mediapipe-pose-33',
    frames: [
      { timestampMs: 0, landmarks: [{ x: 0.5, y: 0.4, visibility: 0.9 }] },
      { timestampMs: 100, landmarks: [{ x: 0.5, y: 0.6, visibility: 0.9 }] },
    ],
  };
}

function mockFetchOnce(payload: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  } as Response);
}

describe('getReferenceFrames', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('sem referenceModelUri devolve a sintética, marcada como tal', async () => {
    const sequence = await getReferenceFrames('agachamento');

    expect(sequence.isSynthetic).toBe(true);
    expect(sequence.frames.length).toBeGreaterThan(0);
  });

  it('baixa e converte a sequência publicada', async () => {
    mockFetchOnce(publishedSequence());

    const sequence = await getReferenceFrames('agachamento', 'https://cdn.example.com/a.json');

    expect(sequence.isSynthetic).toBe(false);
    expect(sequence.frames).toEqual([
      { timestampMs: 0, landmarks: [{ x: 0.5, y: 0.4, visibility: 0.9 }] },
      { timestampMs: 100, landmarks: [{ x: 0.5, y: 0.6, visibility: 0.9 }] },
    ]);
  });

  it('guarda em cache: a segunda chamada não vai à rede', async () => {
    mockFetchOnce(publishedSequence());
    await getReferenceFrames('agachamento', 'https://cdn.example.com/a.json');

    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;
    const second = await getReferenceFrames('agachamento', 'https://cdn.example.com/a.json');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(second.isSynthetic).toBe(false);
  });

  it('clearCachedSequence força novo download', async () => {
    mockFetchOnce(publishedSequence());
    await getReferenceFrames('agachamento', 'https://cdn.example.com/a.json');

    await clearCachedSequence('agachamento');
    mockFetchOnce(publishedSequence());
    await getReferenceFrames('agachamento', 'https://cdn.example.com/a.json');

    expect(global.fetch).toHaveBeenCalled();
  });

  it('falha de rede cai na sintética em vez de travar a tela', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const sequence = await getReferenceFrames('agachamento', 'https://cdn.example.com/a.json');

    expect(sequence.isSynthetic).toBe(true);
  });

  it('rejeita formato de landmark desconhecido', async () => {
    mockFetchOnce({ ...publishedSequence(), landmarkFormat: 'coco-17' });
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect((await getReferenceFrames('agachamento', 'https://cdn.example.com/a.json')).isSynthetic).toBe(true);
  });

  it('rejeita sequência de outro exercício', async () => {
    mockFetchOnce(publishedSequence('flexao-de-braco'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect((await getReferenceFrames('agachamento', 'https://cdn.example.com/a.json')).isSynthetic).toBe(true);
  });

  it('rejeita sequência sem frames', async () => {
    mockFetchOnce({ ...publishedSequence(), frames: [] });
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect((await getReferenceFrames('agachamento', 'https://cdn.example.com/a.json')).isSynthetic).toBe(true);
  });
});
