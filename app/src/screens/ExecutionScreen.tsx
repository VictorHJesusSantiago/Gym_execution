import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, TextInput, Vibration } from 'react-native';
import { CameraView } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { usePoseSession } from '../hooks/usePoseSession';
import { useCameraCapture } from '../hooks/useCameraCapture';
import { useSessionSubmit } from '../hooks/useSessionSubmit';
import { useAuth } from '../hooks/useAuth';
import { PlatformPoseDetector } from '../services/poseDetector';
import { getReferenceFrames } from '../services/referenceLibrary';
import { getWarmupTip } from '../services/warmupTips';
import { loadPreferences, DEFAULT_PREFERENCES, type Preferences } from '../services/preferencesStorage';
import { getContrastColors, scaleFontSize } from '../services/accessibilityStyles';
import { getScoreColors } from '../services/colorPalette';
import { EXERCISES } from '../services/exerciseCatalog';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Execution'>;

function parseWeightKg(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function exerciseName(exerciseId: string): string {
  return EXERCISES.find((exercise) => exercise.id === exerciseId)?.name ?? exerciseId;
}

export function ExecutionScreen({ route, navigation }: Props) {
  const { exerciseId } = route.params;
  const { token } = useAuth();

  const detector = useMemo(() => new PlatformPoseDetector(), []);
  const referenceFrames = useMemo(() => getReferenceFrames(exerciseId), [exerciseId]);
  const warmupTip = useMemo(() => getWarmupTip(exerciseId), [exerciseId]);

  const { status, score, asymmetry, repCount, fatigue, feedback, start, captureFrame, finish } =
    usePoseSession(detector, referenceFrames);

  const [weightInput, setWeightInput] = useState('');
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  // Câmera, permissões e loop de captura de frames (useCameraCapture)
  const { permission, requestPermission, cameraRef, stopCapture } = useCameraCapture(
    status === 'recording',
    captureFrame
  );

  // Envio do resultado, offline queue e navegação (useSessionSubmit)
  const { submit } = useSessionSubmit(navigation);

  useEffect(() => {
    loadPreferences().then(setPreferences);
  }, []);

  const contrast = getContrastColors(preferences.highContrast);
  const colors = getScoreColors(preferences.colorBlindMode);
  const fontSize = (base: number) => scaleFontSize(base, preferences.largeText);

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (feedback) Vibration.vibrate(100);
  }, [feedback?.joint]);

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
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, score]);

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: contrast.background }]}>
        <Text style={[styles.text, { color: contrast.muted, fontSize: fontSize(16) }]}>
          Solicitando permissão da câmera...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: contrast.background }]}>
        <Text style={[styles.text, { color: contrast.muted, fontSize: fontSize(16) }]}>
          Precisamos da sua permissão para usar a câmera e analisar o exercício.
        </Text>
        {permission.canAskAgain ? (
          <Pressable
            style={styles.button}
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="Conceder permissão da câmera"
          >
            <Text style={styles.buttonText}>Conceder permissão</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.button}
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Abrir configurações do app"
          >
            <Text style={styles.buttonText}>Abrir configurações do app</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: contrast.background }]}
      accessibilityLabel={`Execução do exercício ${exerciseName(exerciseId)}`}
    >
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
        accessibilityLabel="Câmera de análise de pose"
      />
      <Text style={[styles.text, { color: contrast.muted, fontSize: fontSize(16) }]}>
        {status === 'loading' && 'Carregando modelo de análise de pose...'}
        {status === 'recording' && 'Câmera ativa — execute o movimento'}
        {status === 'finished' && 'Calculando resultado...'}
      </Text>
      <Text style={[styles.exerciseId, { color: contrast.muted, fontSize: fontSize(14) }]}>
        Exercício: {exerciseName(exerciseId)}
      </Text>
      {status === 'loading' && (
        <Text style={[styles.warmupHint, { color: colors.positive, fontSize: fontSize(13) }]}>{warmupTip}</Text>
      )}
      {status === 'recording' && feedback && (
        <Text
          style={[styles.feedbackHint, { color: colors.warning, fontSize: fontSize(15) }]}
          accessibilityLabel={`Dica de correção: ${feedback.message}`}
        >
          {feedback.message}
        </Text>
      )}
      <View style={styles.weightRow}>
        <Text style={[styles.text, { color: contrast.muted, fontSize: fontSize(16) }]}>Carga (kg):</Text>
        <TextInput
          style={[styles.weightInput, { color: contrast.text, fontSize: fontSize(16) }]}
          keyboardType="numeric"
          placeholder="opcional"
          value={weightInput}
          onChangeText={setWeightInput}
          editable={status === 'recording'}
          accessibilityLabel="Carga em quilogramas, opcional"
        />
      </View>
      <Text style={[styles.disclaimer, { color: contrast.muted, fontSize: fontSize(12) }]}>
        Pontuação experimental: a comparação com a referência ainda não usa o padrão real deste exercício.
      </Text>
      <Pressable
        style={[styles.button, status !== 'recording' && styles.buttonDisabled]}
        onPress={handleFinish}
        disabled={status !== 'recording'}
        accessibilityRole="button"
        accessibilityLabel="Finalizar série"
        accessibilityState={{ disabled: status !== 'recording' }}
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
  feedbackHint: { fontSize: 15, fontWeight: '700', color: '#dc2626', textAlign: 'center' },
  warmupHint: { fontSize: 13, color: '#16a34a', textAlign: 'center', maxWidth: 280 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weightInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    width: 90,
    fontSize: 16,
  },
  disclaimer: { fontSize: 12, color: '#b45309', textAlign: 'center' },
  button: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
