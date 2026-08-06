import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from '@react-navigation/native';
import { PlatformPoseDetector } from '../services/poseDetector';
import { clearBodyCalibration, loadBodyCalibration, saveBodyCalibration, type BodyCalibration } from '../services/bodyCalibration';
import { useTheme } from '../hooks/usePreferences';

type CaptureStatus = 'idle' | 'capturing' | 'error';

/**
 * Tela de Calibração corporal (README.md — Configurações): captura uma
 * única foto em pose neutra (em pé, de frente para a câmera, braços ao
 * lado do corpo) e mede a assimetria "natural" do usuário com
 * `computeAsymmetry`, salvando-a localmente via `bodyCalibration`. O
 * ResultScreen usa essa linha de base para ajustar o limiar de assimetria
 * por pessoa.
 */
export function CalibrationScreen() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [calibration, setCalibration] = useState<BodyCalibration | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadBodyCalibration().then((loaded) => {
        if (active) setCalibration(loaded);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  async function handleCapture() {
    if (!cameraRef.current) return;
    setStatus('capturing');
    const detector = new PlatformPoseDetector();
    try {
      await detector.load();
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, skipProcessing: true });
      if (!photo) {
        setStatus('error');
        return;
      }
      const frame = await detector.detect(Date.now(), photo);
      if (photo.uri.startsWith('file://')) {
        FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => {});
      }
      if (!frame) {
        setStatus('error');
        return;
      }
      setCalibration(await saveBodyCalibration(frame));
      setStatus('idle');
    } catch {
      setStatus('error');
    } finally {
      detector.dispose();
    }
  }

  async function handleClear() {
    await clearBodyCalibration();
    setCalibration(null);
  }

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.text, { color: theme.muted }]}>Solicitando permissão da câmera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.text, { color: theme.muted }]}>Precisamos da sua permissão para usar a câmera e calibrar.</Text>
        {permission.canAskAgain ? (
          <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={requestPermission}>
            <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Conceder permissão</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => Linking.openSettings()}>
            <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Abrir configurações do app</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <CameraView ref={cameraRef} style={styles.camera} facing="front" />
      <Text style={[styles.text, { color: theme.muted }]}>
        Fique de pé, de frente para a câmera, em postura neutra (braços ao lado do corpo) e toque em "Calibrar".
      </Text>
      {calibration && (
        <Text style={[styles.result, { color: theme.text }]}>Assimetria natural registrada: {calibration.baselineAsymmetryPercent}%</Text>
      )}
      {status === 'error' && (
        <Text style={[styles.error, { color: theme.danger }]}>Não foi possível detectar a pose. Tente novamente com melhor iluminação.</Text>
      )}
      <Pressable
        style={[styles.button, { backgroundColor: status === 'capturing' ? theme.disabled : theme.primary }]}
        onPress={handleCapture}
        disabled={status === 'capturing'}
      >
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{status === 'capturing' ? 'Calibrando...' : 'Calibrar'}</Text>
      </Pressable>
      {calibration && (
        <Pressable style={styles.secondaryButton} onPress={handleClear}>
          <Text style={[styles.secondaryButtonText, { color: theme.danger }]}>Limpar calibração</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  camera: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden' },
  text: { fontSize: 16, textAlign: 'center' },
  result: { fontSize: 14, textAlign: 'center' },
  error: { fontSize: 13, textAlign: 'center' },
  button: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  secondaryButton: { paddingVertical: 8, paddingHorizontal: 16 },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },
});
