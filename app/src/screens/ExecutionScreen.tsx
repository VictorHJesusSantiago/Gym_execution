import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, TextInput, Vibration } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { usePoseSession } from '../hooks/usePoseSession';
import { useAuth } from '../hooks/useAuth';
import { PlatformPoseDetector } from '../services/poseDetector';
import { enqueuePendingSession } from '../services/pendingSessionsQueue';
import { getReferenceFrames } from '../services/referenceLibrary';
import { listAllMySessions, recordSession } from '../services/sessionsService';
import { computePersonalRecord, detectNewRecords, detectOverload } from '../services/sessionInsights';
import { getWarmupTip } from '../services/warmupTips';
import { loadPreferences, DEFAULT_PREFERENCES, type Preferences } from '../services/preferencesStorage';
import { getContrastColors, scaleFontSize } from '../services/accessibilityStyles';
import { getScoreColors } from '../services/colorPalette';
import { EXERCISES } from '../services/exerciseCatalog';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Execution'>;

const SAMPLE_INTERVAL_MS = 100; // ~10 fps de amostragem — suficiente para análise de pose, leve para 2GB RAM

/** Converte o texto do campo de carga (aceita vírgula) num número não-negativo, ou `null` se vazio/inválido. */
function parseWeightKg(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function exerciseName(exerciseId: string): string {
  return EXERCISES.find((exercise) => exercise.id === exerciseId)?.name ?? exerciseId;
}

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
  const warmupTip = useMemo(() => getWarmupTip(exerciseId), [exerciseId]);
  const { status, score, asymmetry, repCount, fatigue, feedback, start, captureFrame, finish } = usePoseSession(
    detector,
    referenceFrames
  );

  const [weightInput, setWeightInput] = useState('');
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturingRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Preferências de acessibilidade (tela de Configurações): contraste e
  // tamanho de fonte aplicados durante a execução do exercício.
  useEffect(() => {
    loadPreferences().then(setPreferences);
  }, []);

  const contrast = getContrastColors(preferences.highContrast);
  const colors = getScoreColors(preferences.colorBlindMode);
  const fontSize = (base: number) => scaleFontSize(base, preferences.largeText);

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

  /** Vibra para chamar atenção sempre que uma nova dica de correção aparece. */
  useEffect(() => {
    if (feedback) Vibration.vibrate(100);
  }, [feedback?.joint]);

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
      const weightKg = parseWeightKg(weightInput);
      recordSession(token, exerciseId, score, executedAt, weightKg).catch(() => {
        enqueuePendingSession({
          exerciseId,
          score,
          executedAt: executedAt.toISOString(),
          weightKg,
        }).catch(() => {});
      });

      // Compara com o histórico anterior a esta sessão para detectar recordes
      // pessoais e aumentos de carga acima do esperado (README.md — "Saúde e
      // segurança"). Falha ao buscar o histórico não bloqueia o resultado.
      listAllMySessions(token)
        .then((sessions) => {
          const previousSessions = sessions.filter((s) => new Date(s.executed_at) < executedAt);
          navigation.replace('Result', {
            score,
            exerciseId,
            asymmetry,
            repCount,
            fatigue,
            newRecords: detectNewRecords({ score, weightKg }, computePersonalRecord(previousSessions, exerciseId)),
            overload: detectOverload(previousSessions, exerciseId, weightKg),
            weightKg,
          });
        })
        .catch(() => {
          navigation.replace('Result', {
            score,
            exerciseId,
            asymmetry,
            repCount,
            fatigue,
            newRecords: null,
            overload: null,
            weightKg,
          });
        });
      return;
    }

    navigation.replace('Result', {
      score,
      exerciseId,
      asymmetry,
      repCount,
      fatigue,
      newRecords: null,
      overload: null,
      weightKg: parseWeightKg(weightInput),
    });
  }, [status, score, asymmetry, repCount, fatigue, exerciseId, navigation, token, weightInput]);

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
    // Quando o usuário já negou permanentemente (`canAskAgain === false`),
    // `requestPermission()` não reabre o diálogo do sistema — só a tela de
    // configurações do app permite reverter.
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
      <CameraView ref={cameraRef} style={styles.camera} facing="front" accessibilityLabel="Câmera de análise de pose" />
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
        Pontuação experimental: a comparação com a referência ainda não usa o
        padrão real deste exercício.
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
