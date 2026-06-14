jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../poseScoring', () => ({
  computeAsymmetry: jest.fn(() => ({ overallPercent: 12, byJoint: { elbow: 0, knee: 12, hip: 0 } })),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearBodyCalibration, loadBodyCalibration, saveBodyCalibration } from '../bodyCalibration';
import { computeAsymmetry } from '../poseScoring';
import type { PoseFrame } from '../poseTypes';

const FRAME: PoseFrame = { timestampMs: 0, landmarks: [] };

describe('bodyCalibration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (computeAsymmetry as jest.Mock).mockClear();
  });

  it('retorna null quando nada foi calibrado ainda', async () => {
    expect(await loadBodyCalibration()).toBeNull();
  });

  it('mede a assimetria do frame de calibração e persiste como linha de base', async () => {
    const calibration = await saveBodyCalibration(FRAME);

    expect(computeAsymmetry).toHaveBeenCalledWith([FRAME]);
    expect(calibration).toEqual({ baselineAsymmetryPercent: 12 });
    expect(await loadBodyCalibration()).toEqual({ baselineAsymmetryPercent: 12 });
  });

  it('usa 0 quando computeAsymmetry retorna null (sequência vazia)', async () => {
    (computeAsymmetry as jest.Mock).mockReturnValueOnce(null);

    const calibration = await saveBodyCalibration(FRAME);

    expect(calibration).toEqual({ baselineAsymmetryPercent: 0 });
  });

  it('clearBodyCalibration remove a calibração salva', async () => {
    await saveBodyCalibration(FRAME);
    await clearBodyCalibration();

    expect(await loadBodyCalibration()).toBeNull();
  });

  it('retorna null quando o conteúdo salvo está corrompido', async () => {
    await AsyncStorage.setItem('@gym_execution/body_calibration', '{ json inválido');

    expect(await loadBodyCalibration()).toBeNull();
  });
});
