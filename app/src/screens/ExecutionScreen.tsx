import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, TextInput, Vibration, ActivityIndicator } from 'react-native';
import { CameraView } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { usePoseSession } from '../hooks/usePoseSession';
import { useCameraCapture } from '../hooks/useCameraCapture';
import { useSessionSubmit } from '../hooks/useSessionSubmit';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { useReferenceSequence } from '../hooks/useReferenceSequence';
import { PlatformPoseDetector } from '../services/poseDetector';
import { getWarmupTip } from '../services/warmupTips';
import { scaleFontSize } from '../services/accessibilityStyles';
import { exerciseName } from '../services/exerciseCatalog';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Execution'>;

const FEEDBACK_VIBRATION_MS = 100;

function parseWeightKg(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function ExecutionScreen({ route, navigation }: Props) {
  const { exerciseId } = route.params;
  const { token } = useAuth();
  const { preferences, theme } = usePreferences();

  const detector = useMemo(() => new PlatformPoseDetector(), []);
  const warmupTip = useMemo(() => getWarmupTip(exerciseId), [exerciseId]);

  // A referência agora é BAIXADA (e cacheada) do storage de mídia quando o
  // exercício tem uma publicada — ver useReferenceSequence/ADR-0001.
  const reference = useReferenceSequence(exerciseId);
  const referenceFrames = reference.status === 'ready' ? reference.frames : EMPTY_FRAMES;

  const { status, score, asymmetry, repCount, fatigue, feedback, start, captureFrame, finish } =
    usePoseSession(detector, referenceFrames);

  const [weightInput, setWeightInput] = useState('');

  // Câmera, permissões e loop de captura de frames (useCameraCapture)
  const { permission, requestPermission, cameraRef, stopCapture } = useCameraCapture(
    status === 'recording',
    captureFrame
  );

  // Envio do resultado, offline queue e navegação (useSessionSubmit)
  const { submit } = useSessionSubmit(navigation);

  const fontSize = (base: number) => scaleFontSize(base, preferences.largeText);

  // Só inicia depois que a referência estiver resolvida: começar antes faria a
  // série ser pontuada contra uma lista vazia (score 0 garantido). É o passo
  // `LoadingReference` do diagrama de estados do README.md.
  useEffect(() => {
    if (reference.status === 'ready') start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference.status]);

  useEffect(() => {
    if (feedback && preferences.vibrationFeedback) Vibration.vibrate(FEEDBACK_VIBRATION_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback?.joint, preferences.vibrationFeedback]);

  function handleFinish() {
    stopCapture();
    finish();
  }

  useEffect(() => {
    if (status !== 'finished' || score === null) return;
    submit({
      token,
      exerciseId,
      score,
      weightKg: parseWeightKg(weightInput),
      asymmetry,
      repCount,
      fatigue,
      referenceIsSynthetic: reference.status === 'ready' ? reference.isSynthetic : true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, score]);

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.text, { color: theme.muted, fontSize: fontSize(16) }]}>
          Solicitando permissão da câmera...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.text, { color: theme.muted, fontSize: fontSize(16) }]}>
          Precisamos da sua permissão para usar a câmera e analisar o exercício.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={permission.canAskAgain ? requestPermission : () => Linking.openSettings()}
          accessibilityRole="button"
          accessibilityLabel={
            permission.canAskAgain ? 'Conceder permissão da câmera' : 'Abrir configurações do app'
          }
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
            {permission.canAskAgain ? 'Conceder permissão' : 'Abrir configurações do app'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (reference.status === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.text, { color: theme.muted, fontSize: fontSize(16) }]}>
          Preparando o padrão de referência...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background }]}
      accessibilityLabel={`Execução do exercício ${exerciseName(exerciseId)}`}
    >
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
        accessibilityLabel="Câmera de análise de pose"
      />
      <Text style={[styles.text, { color: theme.muted, fontSize: fontSize(16) }]}>
        {status === 'loading' && 'Carregando modelo de análise de pose...'}
        {status === 'recording' && 'Câmera ativa — execute o movimento'}
        {status === 'finished' && 'Calculando resultado...'}
      </Text>
      <Text style={[styles.exerciseId, { color: theme.muted, fontSize: fontSize(14) }]}>
        Exercício: {exerciseName(exerciseId)}
      </Text>
      {status === 'loading' && (
        <Text style={[styles.warmupHint, { color: theme.positive, fontSize: fontSize(13) }]}>{warmupTip}</Text>
      )}
      {status === 'recording' && feedback && (
        <Text
          style={[styles.feedbackHint, { color: theme.warning, fontSize: fontSize(15) }]}
          accessibilityLabel={`Dica de correção: ${feedback.message}`}
        >
          {feedback.message}
        </Text>
      )}
      <View style={styles.weightRow}>
        <Text style={[styles.text, { color: theme.muted, fontSize: fontSize(16) }]}>Carga (kg):</Text>
        <TextInput
          style={[styles.weightInput, { color: theme.text, borderColor: theme.border, fontSize: fontSize(16) }]}
          keyboardType="numeric"
          placeholder="opcional"
          placeholderTextColor={theme.muted}
          value={weightInput}
          onChangeText={setWeightInput}
          editable={status === 'recording'}
          accessibilityLabel="Carga em quilogramas, opcional"
        />
      </View>
      {/* Aviso condicionado à referência REAL: some sozinho quando o exercício
          passar a ter uma sequência publicada, em vez de mentir nos dois
          sentidos. Não remover enquanto o ADR-0001 estiver aberto. */}
      {reference.isSynthetic && (
        <Text style={[styles.disclaimer, { color: theme.warning, fontSize: fontSize(12) }]}>
          Pontuação experimental: este exercício ainda não tem um padrão de referência publicado.
        </Text>
      )}
      <Pressable
        style={[
          styles.button,
          { backgroundColor: status === 'recording' ? theme.primary : theme.disabled },
        ]}
        onPress={handleFinish}
        disabled={status !== 'recording'}
        accessibilityRole="button"
        accessibilityLabel="Finalizar série"
        accessibilityState={{ disabled: status !== 'recording' }}
      >
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Finalizar série</Text>
      </Pressable>
    </View>
  );
}

/** Constante estável: um `[]` novo a cada render invalidaria os callbacks de
 * `usePoseSession` (e o cache de ângulos por identidade em `poseScoring`). */
const EMPTY_FRAMES: never[] = [];

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  camera: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden' },
  text: { textAlign: 'center' },
  exerciseId: {},
  feedbackHint: { fontWeight: '700', textAlign: 'center' },
  warmupHint: { textAlign: 'center', maxWidth: 280 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weightInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    width: 90,
  },
  disclaimer: { textAlign: 'center', maxWidth: 300 },
  button: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
