import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { ASYMMETRY_THRESHOLD_PERCENT, type AsymmetricJoint } from '../services/poseScoring';
import { loadBodyCalibration } from '../services/bodyCalibration';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Result'>;

const JOINT_LABELS: Record<AsymmetricJoint, string> = {
  elbow: 'cotovelos',
  knee: 'joelhos',
  hip: 'quadris',
};

export function ResultScreen({ route, navigation }: Props) {
  const { score, exerciseId, asymmetry, repCount, fatigue } = route.params;

  // Pessoas com assimetria corporal natural (medida na Calibração) não devem
  // ser sinalizadas por algo que já é normal para elas — somamos essa
  // linha de base ao limiar padrão antes de comparar.
  const [asymmetryThreshold, setAsymmetryThreshold] = useState(ASYMMETRY_THRESHOLD_PERCENT);

  useEffect(() => {
    loadBodyCalibration().then((calibration) => {
      if (calibration) setAsymmetryThreshold(ASYMMETRY_THRESHOLD_PERCENT + calibration.baselineAsymmetryPercent);
    });
  }, []);

  const asymmetricJoints = asymmetry
    ? (Object.entries(asymmetry.byJoint) as Array<[AsymmetricJoint, number]>).filter(
        ([, percent]) => percent >= asymmetryThreshold
      )
    : [];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Execução do exercício "{exerciseId}"</Text>
      <Text style={styles.score}>{score}%</Text>
      <Text style={styles.hint}>de acordo com o padrão de referência</Text>
      {repCount != null && repCount > 0 && (
        <Text style={styles.repCount}>Repetições detectadas: {repCount}</Text>
      )}
      {asymmetricJoints.length > 0 && (
        <Text style={styles.asymmetryWarning}>
          Possível assimetria entre os lados do corpo:{' '}
          {asymmetricJoints.map(([joint, percent]) => `${JOINT_LABELS[joint]} (${percent}%)`).join(', ')}.
        </Text>
      )}
      {fatigue?.degraded && (
        <Text style={styles.fatigueWarning}>
          A forma da última repetição ficou diferente da primeira ({fatigue.consistencyPercent}% de consistência) —
          possível sinal de fadiga.
        </Text>
      )}
      <Text style={styles.disclaimer}>
        Pontuação experimental — ainda não compara com o padrão real deste exercício.
      </Text>
      <Pressable style={styles.button} onPress={() => navigation.popToTop()}>
        <Text style={styles.buttonText}>Voltar ao início</Text>
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
  asymmetryWarning: { fontSize: 13, color: '#dc2626', textAlign: 'center', marginBottom: 8, maxWidth: 280 },
  fatigueWarning: { fontSize: 13, color: '#b45309', textAlign: 'center', marginBottom: 8, maxWidth: 280 },
  button: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
