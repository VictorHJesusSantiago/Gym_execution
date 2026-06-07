import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { usePoseSession } from '../hooks/usePoseSession';
import { useAuth } from '../hooks/useAuth';
import { MockPoseDetector } from '../services/mockPoseDetector';
import { getReferenceFrames } from '../services/referenceLibrary';
import { recordSession } from '../services/sessionsService';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Execution'>;

const SAMPLE_INTERVAL_MS = 100; // ~10 fps de amostragem — suficiente para análise de pose, leve para 2GB RAM

/**
 * Tela de execução: liga o detector de pose (hoje, `MockPoseDetector` —
 * trocar por integração real com MediaPipe/TFLite, conforme
 * ARCHITECTURE.md seção 4) à câmera e ao algoritmo de scoring.
 *
 * A captura de vídeo da câmera (ex: `expo-camera`) entra aqui chamando
 * `captureFrame` a cada quadro processado; por ora simulamos esse laço
 * com um intervalo, para validar o fluxo ponta a ponta sem dependências
 * nativas adicionais.
 */
export function ExecutionScreen({ route, navigation }: Props) {
  const { exerciseId } = route.params;

  const { token } = useAuth();
  const detector = useMemo(() => new MockPoseDetector(), []);
  const referenceFrames = useMemo(() => getReferenceFrames(exerciseId), [exerciseId]);
  const { status, score, start, captureFrame, finish } = usePoseSession(detector, referenceFrames);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        captureFrame(Date.now());
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
    // histórico do usuário — ver ARCHITECTURE.md seção 5. Falha de rede
    // não deve bloquear o feedback imediato ao usuário, por isso seguimos
    // para a tela de resultado mesmo que o registro falhe (log silencioso).
    if (token) {
      recordSession(token, exerciseId, score, new Date()).catch(() => {
        // intencional: ver comentário acima — feedback local prevalece
      });
    }

    navigation.replace('Result', { score, exerciseId });
  }, [status, score, exerciseId, navigation, token]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {status === 'loading' && 'Carregando modelo de análise de pose...'}
        {status === 'recording' && 'Câmera ativa — execute o movimento'}
        {status === 'finished' && 'Calculando resultado...'}
      </Text>
      <Text style={styles.exerciseId}>Exercício: {exerciseId}</Text>
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
  text: { fontSize: 16, textAlign: 'center', color: '#555' },
  exerciseId: { fontSize: 14, color: '#94a3b8' },
  button: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
