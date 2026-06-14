import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeAsymmetry } from './poseScoring';
import type { PoseFrame } from './poseTypes';

const STORAGE_KEY = '@gym_execution/body_calibration';

export type BodyCalibration = {
  /** Assimetria "natural" do corpo do usuário, medida numa pose neutra. */
  baselineAsymmetryPercent: number;
};

/**
 * Calibração corporal local (README.md — tela de Configurações). Mede a
 * assimetria de um frame em pose neutra e guarda essa "linha de base" no
 * dispositivo, para distinguir assimetria natural do corpo de uma
 * compensação durante o exercício (ver ResultScreen).
 */
export async function loadBodyCalibration(): Promise<BodyCalibration | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BodyCalibration;
  } catch {
    return null;
  }
}

/** Mede a assimetria do frame de calibração (pose neutra) e a persiste como linha de base. */
export async function saveBodyCalibration(frame: PoseFrame): Promise<BodyCalibration> {
  const asymmetry = computeAsymmetry([frame]);
  const calibration: BodyCalibration = { baselineAsymmetryPercent: asymmetry?.overallPercent ?? 0 };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(calibration));
  return calibration;
}

export async function clearBodyCalibration(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
