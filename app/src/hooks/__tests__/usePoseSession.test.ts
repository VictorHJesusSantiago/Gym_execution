jest.mock('../../services/poseScoring', () => ({
  scoreExecution: jest.fn(() => 77),
}));

import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { usePoseSession } from '../usePoseSession';
import { scoreExecution } from '../../services/poseScoring';
import type { CameraFrameInput, PoseDetector, PoseFrame } from '../../services/poseTypes';

const FRAME: CameraFrameInput = { uri: 'file://frame.jpg', width: 192, height: 192 };
const REFERENCE_FRAMES: PoseFrame[] = [{ timestampMs: 0, landmarks: [] }];

function createDetector(detect?: PoseDetector['detect']): PoseDetector {
  return {
    load: jest.fn().mockResolvedValue(undefined),
    detect: detect ?? jest.fn().mockResolvedValue(null),
    dispose: jest.fn(),
  };
}

/** Renderiza o hook via um componente "harness" e expõe seu retorno mais recente. */
function renderPoseSession(detector: PoseDetector, referenceFrames: PoseFrame[]) {
  const result = {} as { current: ReturnType<typeof usePoseSession> };

  function Harness() {
    result.current = usePoseSession(detector, referenceFrames);
    return null;
  }

  act(() => {
    create(createElement(Harness));
  });

  return result;
}

describe('usePoseSession', () => {
  beforeEach(() => {
    (scoreExecution as jest.Mock).mockClear();
  });

  it('inicia em idle sem score calculado', () => {
    const result = renderPoseSession(createDetector(), REFERENCE_FRAMES);

    expect(result.current.status).toBe('idle');
    expect(result.current.score).toBeNull();
  });

  it('start() carrega o detector e passa para recording', async () => {
    const detector = createDetector();
    const result = renderPoseSession(detector, REFERENCE_FRAMES);

    await act(async () => {
      await result.current.start();
    });

    expect(detector.load).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('recording');
  });

  it('captureFrame é no-op (sem chamar o detector) fora de recording', async () => {
    const detect = jest.fn().mockResolvedValue({ timestampMs: 1, landmarks: [] });
    const detector = createDetector(detect);
    const result = renderPoseSession(detector, REFERENCE_FRAMES);

    await act(async () => {
      await result.current.captureFrame(100, FRAME);
    });

    expect(detect).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('captureFrame roda o detector e acumula o frame durante recording', async () => {
    const capturedFrame: PoseFrame = { timestampMs: 200, landmarks: [] };
    const detect = jest.fn().mockResolvedValue(capturedFrame);
    const detector = createDetector(detect);
    const result = renderPoseSession(detector, REFERENCE_FRAMES);

    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.captureFrame(200, FRAME);
    });

    expect(detect).toHaveBeenCalledWith(200, FRAME);

    act(() => {
      result.current.finish();
    });

    expect(scoreExecution).toHaveBeenCalledWith([capturedFrame], REFERENCE_FRAMES);
  });

  it('finish() calcula o score, finaliza a sessão e libera o detector', async () => {
    const detector = createDetector();
    const result = renderPoseSession(detector, REFERENCE_FRAMES);

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.finish();
    });

    expect(scoreExecution).toHaveBeenCalledTimes(1);
    expect(result.current.score).toBe(77);
    expect(result.current.status).toBe('finished');
    expect(detector.dispose).toHaveBeenCalledTimes(1);
  });

  it('finish() é no-op se a sessão não estiver em recording', () => {
    const detector = createDetector();
    const result = renderPoseSession(detector, REFERENCE_FRAMES);

    act(() => {
      result.current.finish();
    });

    expect(scoreExecution).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.score).toBeNull();
    expect(detector.dispose).not.toHaveBeenCalled();
  });
});
