import { useCallback, useEffect, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import type { CameraFrameInput } from '../services/poseTypes';
import { usePreferences } from './usePreferences';
import { CAMERA_QUALITY_SETTINGS } from '../services/preferencesStorage';

const SAMPLE_INTERVAL_MS = 100; // ~10 fps de amostragem (DOM05 — fixo de propósito)

type CaptureHandler = (timestampMs: number, frame: CameraFrameInput) => Promise<void>;

/**
 * Gerencia ciclo de vida da câmera: permissões, intervalo de captura de
 * frames e limpeza de arquivos temporários. Extraído de ExecutionScreen (M8)
 * para isolar a responsabilidade de hardware da lógica de execução.
 *
 * `isRecording` controla o intervalo: inicia quando true, para quando false.
 * `onCapture` é chamado a cada frame capturado com sucesso.
 *
 * A compressão do JPEG vem da preferência "Qualidade da câmera" (RF08), que
 * antes era gravada e ignorada — o valor estava fixo em 0.5 aqui, então o
 * seletor de três opções da tela de Configurações não mudava absolutamente
 * nada no consumo de memória do aparelho que ele dizia proteger.
 */
export function useCameraCapture(isRecording: boolean, onCapture: CaptureHandler) {
  const { preferences } = usePreferences();
  const captureQuality = CAMERA_QUALITY_SETTINGS[preferences.cameraQuality].quality;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturingRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!isRecording) return;

    intervalRef.current = setInterval(() => {
      if (capturingRef.current || !cameraRef.current) return;
      capturingRef.current = true;

      cameraRef.current
        .takePictureAsync({ quality: captureQuality, skipProcessing: true })
        .then((photo) => {
          if (!photo) return;
          const frame: CameraFrameInput = { uri: photo.uri, width: photo.width, height: photo.height };
          return onCapture(Date.now(), frame).finally(() => {
            // Em iOS/Android `photo.uri` é arquivo temporário no cache —
            // sem isso, cada frame (~10/s) acumula JPEGs órfãos.
            if (photo.uri.startsWith('file://')) {
              FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => {});
            }
          });
        })
        .catch((err) => {
          // Falha isolada num frame não derruba o loop — a próxima amostra tenta de novo.
          console.warn('[useCameraCapture] falha ao capturar/processar frame', err);
        })
        .finally(() => {
          capturingRef.current = false;
        });
    }, SAMPLE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRecording, onCapture, captureQuality]);

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return { permission, requestPermission, cameraRef, stopCapture };
}
