import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { usePoseSession } from '../hooks/usePoseSession';
import { useAuth } from '../hooks/useAuth';
import { PlatformPoseDetector } from '../services/poseDetector';
import { enqueuePendingSession } from '../services/pendingSessionsQueue';
import { getReferenceFrames } from '../services/referenceLibrary';
import { recordSession } from '../services/sessionsService';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Execution'>;

const SAMPLE_INTERVAL_MS = 100; // ~10 fps de amostragem — suficiente para análise de pose, leve para 2GB RAM

/**
 * Tela de execução: liga o detector de pose real (`PlatformPoseDetector` —
 * MediaPipe Tasks Vision na web, MoveNet/TFLite em iOS/Android, ver
 * README.md "Stack") à câmera e ao algoritmo de scoring.
 *
 * A cada `SAMPLE_INTERVAL_MS`, captura uma foto via `CameraView.takePictureAsync`
 * e envia para `captureFrame`, que roda o detector e acumula o `PoseFrame`
 * resultante.
 */
export function ExecutionScreen({ route, navigation }: Props) {
  const { exerciseId } = route.params;

  const { token } = useAuth();
  const detector = useMemo(() => new PlatformPoseDetector(), []);
  const referenceFrames = useMemo(() => getReferenceFrames(exerciseId), [exerciseId]);
  const { status, score, start, captureFrame, finish } = usePoseSession(detector, referenceFrames);

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
    start();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === 'recording' && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        if (capturingRef.current || !cameraRef.current) return;
        capturingRef.current = true;
        cameraRef.current
          .takePictureAsync({ quality: 0.5, skipProcessing: true })
          .then((photo) => {
            if (!photo) return;
            return captureFrame(Date.now(), photo).finally(() => {
              // Em iOS/Android `photo.uri` é um arquivo temporário no cache
              // (na web é uma string base64) — sem isso, cada frame (~10/s)
              // deixaria um JPEG órfão acumulando no armazenamento.
              if (photo.uri.startsWith('file://')) {
                FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => {});
              }
            });
          })
          .catch((err) => {
            // Falha isolada num frame (câmera ocupada, erro do detector) não
            // deve derrubar o loop nem virar unhandled rejection — a próxima
            // amostra tenta de novo.
            console.warn('[ExecutionScreen] falha ao capturar/processar frame', err);
          })
          .finally(() => {
            capturingRef.current = false;
          });
      }, SAMPLE_INTERVAL_MS);
    }
  }, [status, captureFrame]);

  function handleFinish() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    finish();
  }

  useEffect(() => {
    if (status !== 'finished' || score === null) return;

    // Envia só o resultado calculado localmente (nunca o vídeo) para o
    // histórico do usuário — ver README.md seção 5. Falha de rede
    // não deve bloquear o feedback imediato ao usuário, por isso seguimos
    // para a tela de resultado mesmo que o registro falhe — nesse caso,
    // o resultado entra na fila offline (pendingSessionsQueue) e é
    // reenviado quando o usuário abrir o histórico.
    if (token) {
      const executedAt = new Date();
      recordSession(token, exerciseId, score, executedAt).catch(() => {
        enqueuePendingSession({
          exerciseId,
          score,
          executedAt: executedAt.toISOString(),
        }).catch(() => {});
      });
    }

    navigation.replace('Result', { score, exerciseId });
  }, [status, score, exerciseId, navigation, token]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Solicitando permissão da câmera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    // Quando o usuário já negou permanentemente (`canAskAgain === false`),
    // `requestPermission()` não reabre o diálogo do sistema — só a tela de
    // configurações do app permite reverter.
    return (
      <View style={styles.container}>
        <Text style={styles.text}>
          Precisamos da sua permissão para usar a câmera e analisar o exercício.
        </Text>
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
        {status === 'loading' && 'Carregando modelo de análise de pose...'}
        {status === 'recording' && 'Câmera ativa — execute o movimento'}
        {status === 'finished' && 'Calculando resultado...'}
      </Text>
      <Text style={styles.exerciseId}>Exercício: {exerciseId}</Text>
      <Text style={styles.disclaimer}>
        Pontuação experimental: a comparação com a referência ainda não usa o
        padrão real deste exercício.
      </Text>
      <Pressable
        style={[styles.button, status !== 'recording' && styles.buttonDisabled]}
        onPress={handleFinish}
        disabled={status !== 'recording'}
      >
        <Text style={styles.buttonText}>Finalizar série</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  camera: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden' },
  text: { fontSize: 16, textAlign: 'center', color: '#555' },
  exerciseId: { fontSize: 14, color: '#94a3b8' },
  disclaimer: { fontSize: 12, color: '#b45309', textAlign: 'center' },
  button: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
