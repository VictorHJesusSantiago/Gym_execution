import { useEffect, useState } from 'react';
import { View, Text, Pressable, Share, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { ASYMMETRY_THRESHOLD_PERCENT, type AsymmetricJoint } from '../services/poseScoring';
import { loadBodyCalibration } from '../services/bodyCalibration';
import { computeGoalProgress, loadGoals, type PersonalGoal } from '../services/personalGoals';
import { usePreferences } from '../hooks/usePreferences';
import { scaleFontSize } from '../services/accessibilityStyles';
import { buildResultShareText } from '../services/resultShareText';
import { exerciseName } from '../services/exerciseCatalog';

const REST_SECONDS = 60;

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Result'>;

const JOINT_LABELS: Record<AsymmetricJoint, string> = {
  elbow: 'cotovelos',
  knee: 'joelhos',
  hip: 'quadris',
};

export function ResultScreen({ route, navigation }: Props) {
  const {
    score, exerciseId, asymmetry, repCount, fatigue, newRecords, overload, weightKg,
    referenceIsSynthetic = true,
  } = route.params;
  const { preferences, theme } = usePreferences();

  const [asymmetryThreshold, setAsymmetryThreshold] = useState(ASYMMETRY_THRESHOLD_PERCENT);

  useEffect(() => {
    loadBodyCalibration().then((calibration) => {
      if (calibration) setAsymmetryThreshold(ASYMMETRY_THRESHOLD_PERCENT + calibration.baselineAsymmetryPercent);
    });
  }, []);

  const [goal, setGoal] = useState<PersonalGoal | null>(null);

  useEffect(() => {
    loadGoals().then((goals) => {
      setGoal(goals.find((g) => g.exerciseId === exerciseId) ?? null);
    });
  }, [exerciseId]);

  const goalProgress = computeGoalProgress(goal, { score, weightKg: weightKg ?? null });

  const [restSeconds, setRestSeconds] = useState(REST_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setRestSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fontSize = (base: number) => scaleFontSize(base, preferences.largeText);

  const asymmetricJoints = asymmetry
    ? (Object.entries(asymmetry.byJoint) as Array<[AsymmetricJoint, number]>).filter(
        ([, percent]) => percent >= asymmetryThreshold
      )
    : [];

  async function handleShare() {
    await Share.share({
      message: buildResultShareText({
        exerciseName: exerciseName(exerciseId),
        score,
        repCount,
        weightKg,
        newRecords,
        overload,
        fatigue,
      }),
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} accessibilityLabel="Tela de resultado do treino">
      <Text style={[styles.label, { color: theme.muted, fontSize: fontSize(16) }]}>
        Execução do exercício "{exerciseName(exerciseId)}"
      </Text>
      <Text
        style={[styles.score, { color: theme.accent, fontSize: fontSize(48) }]}
        accessibilityLabel={`Pontuação: ${score} por cento`}
      >
        {score}%
      </Text>
      <Text style={[styles.hint, { color: theme.muted, fontSize: fontSize(14) }]}>
        de acordo com o padrão de referência
      </Text>
      {repCount != null && repCount > 0 && (
        <Text style={[styles.repCount, { color: theme.text, fontSize: fontSize(14) }]}>
          Repetições detectadas: {repCount}
        </Text>
      )}
      {newRecords?.score && (
        <Text style={[styles.recordBadge, { color: theme.positive, fontSize: fontSize(14) }]}>
          Novo recorde de pontuação!
        </Text>
      )}
      {newRecords?.weight && (
        <Text style={[styles.recordBadge, { color: theme.positive, fontSize: fontSize(14) }]}>
          Novo recorde de carga!
        </Text>
      )}
      {goal?.targetScore != null && (
        <Text
          style={[
            goalProgress?.scoreReached ? styles.goalReached : styles.goalPending,
            { color: goalProgress?.scoreReached ? theme.positive : theme.muted, fontSize: fontSize(13) },
          ]}
        >
          Meta de pontuação: {goal.targetScore}%
          {goalProgress?.scoreReached ? ' — atingida!' : ` (faltam ${Math.max(0, goal.targetScore - score)}%)`}
        </Text>
      )}
      {goal?.targetWeightKg != null && (
        <Text
          style={[
            goalProgress?.weightReached ? styles.goalReached : styles.goalPending,
            { color: goalProgress?.weightReached ? theme.positive : theme.muted, fontSize: fontSize(13) },
          ]}
        >
          Meta de carga: {goal.targetWeightKg}kg{goalProgress?.weightReached ? ' — atingida!' : ''}
        </Text>
      )}
      {overload && (
        <Text style={[styles.overloadWarning, { color: theme.warning, fontSize: fontSize(13) }]}>
          Carga {overload.increasePercent}% acima da média recente ({overload.averageRecentWeightKg.toFixed(1)}kg) —
          considere uma progressão mais gradual.
        </Text>
      )}
      {asymmetricJoints.length > 0 && (
        <Text style={[styles.asymmetryWarning, { color: theme.warning, fontSize: fontSize(13) }]}>
          Possível assimetria entre os lados do corpo:{' '}
          {asymmetricJoints.map(([joint, percent]) => `${JOINT_LABELS[joint]} (${percent}%)`).join(', ')}.
        </Text>
      )}
      {fatigue?.degraded && (
        <Text style={[styles.fatigueWarning, { color: theme.warning, fontSize: fontSize(13) }]}>
          A forma da última repetição ficou diferente da primeira ({fatigue.consistencyPercent}% de consistência) —
          possível sinal de fadiga.
        </Text>
      )}
      {}
      {referenceIsSynthetic && (
        <Text style={[styles.disclaimer, { color: theme.warning, fontSize: fontSize(12) }]}>
          Pontuação experimental — este exercício ainda não tem um padrão de referência publicado.
        </Text>
      )}
      <Text style={[styles.restTimer, { color: theme.accent, fontSize: fontSize(13) }]}>
        {restSeconds > 0
          ? `Descanse ${restSeconds}s antes da próxima série — aproveite para se hidratar.`
          : 'Descanso concluído — pronto para a próxima série!'}
      </Text>
      <Pressable
        style={[styles.secondaryButton, { borderColor: theme.primary }]}
        onPress={handleShare}
        accessibilityRole="button"
        accessibilityLabel="Compartilhar resultado"
      >
        <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Compartilhar resultado</Text>
      </Pressable>
      <Pressable
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={() => navigation.popToTop()}
        accessibilityRole="button"
        accessibilityLabel="Voltar ao início"
      >
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Voltar ao início</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  label: { fontSize: 16, color: '#555' },
  score: { fontSize: 48, fontWeight: '800', color: '#2563eb' },
  hint: { fontSize: 14, color: '#94a3b8', marginBottom: 16 },
  disclaimer: { fontSize: 12, color: '#b45309', textAlign: 'center', marginBottom: 16, maxWidth: 280 },
  repCount: { fontSize: 14, color: '#334155', marginBottom: 4 },
  recordBadge: { fontSize: 14, fontWeight: '700', color: '#16a34a', marginBottom: 4 },
  goalReached: { fontSize: 13, fontWeight: '700', color: '#16a34a', marginBottom: 4 },
  goalPending: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  restTimer: { fontSize: 13, color: '#2563eb', textAlign: 'center', marginBottom: 8, maxWidth: 280 },
  overloadWarning: { fontSize: 13, color: '#b45309', textAlign: 'center', marginBottom: 8, maxWidth: 280 },
  asymmetryWarning: { fontSize: 13, color: '#dc2626', textAlign: 'center', marginBottom: 8, maxWidth: 280 },
  fatigueWarning: { fontSize: 13, color: '#b45309', textAlign: 'center', marginBottom: 8, maxWidth: 280 },
  button: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  secondaryButtonText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
});
