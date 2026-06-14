import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from '@react-navigation/native';
import { PlatformPoseDetector } from '../services/poseDetector';
import { clearBodyCalibration, loadBodyCalibration, saveBodyCalibration, type BodyCalibration } from '../services/bodyCalibration';

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
      <View style={styles.container}>
        <Text style={styles.text}>Solicitando permissão da câmera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Precisamos da sua permissão para usar a câmera e calibrar.</Text>
        {permission.canAskAgain ? (
          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Conceder permissão</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.button} onPress={() => Linking.openSettings()}>
            <Text style={styles.buttonText}>Abrir configurações do app</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="front" />
      <Text style={styles.text}>
        Fique de pé, de frente para a câmera, em postura neutra (braços ao lado do corpo) e toque em "Calibrar".
      </Text>
      {calibration && (
        <Text style={styles.result}>Assimetria natural registrada: {calibration.baselineAsymmetryPercent}%</Text>
      )}
      {status === 'error' && (
        <Text style={styles.error}>Não foi possível detectar a pose. Tente novamente com melhor iluminação.</Text>
      )}
      <Pressable
        style={[styles.button, status === 'capturing' && styles.buttonDisabled]}
        onPress={handleCapture}
        disabled={status === 'capturing'}
      >
        <Text style={styles.buttonText}>{status === 'capturing' ? 'Calibrando...' : 'Calibrar'}</Text>
      </Pressable>
      {calibration && (
        <Pressable style={styles.secondaryButton} onPress={handleClear}>
          <Text style={styles.secondaryButtonText}>Limpar calibração</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  camera: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden' },
  text: { fontSize: 16, textAlign: 'center', color: '#555' },
  result: { fontSize: 14, color: '#334155', textAlign: 'center' },
  error: { fontSize: 13, color: '#dc2626', textAlign: 'center' },
  button: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { paddingVertical: 8, paddingHorizontal: 16 },
  secondaryButtonText: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
});
