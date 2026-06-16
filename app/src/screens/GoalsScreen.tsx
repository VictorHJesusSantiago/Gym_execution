import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { EXERCISES } from '../services/exerciseCatalog';
import { loadGoals, removeGoal, saveGoal, type PersonalGoal } from '../services/personalGoals';

function exerciseName(exerciseId: string): string {
  return EXERCISES.find((exercise) => exercise.id === exerciseId)?.name ?? exerciseId;
}

/**
 * Tela de Metas pessoais (README.md — "Progresso e métricas"): define, por
 * exercício, uma meta de pontuação e/ou de carga, persistida localmente
 * (mesmo padrão de `bodyCalibration`). O progresso é exibido na tela de
 * Resultado (ver `ResultScreen`).
 */
export function GoalsScreen() {
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [exerciseId, setExerciseId] = useState(EXERCISES[0].id);
  const [targetScore, setTargetScore] = useState('');
  const [targetWeight, setTargetWeight] = useState('');

  const load = useCallback(() => {
    loadGoals().then(setGoals);
  }, []);

  useFocusEffect(load);

  async function handleSave() {
    const score = targetScore.trim() ? Number(targetScore.trim().replace(',', '.')) : null;
    const weight = targetWeight.trim() ? Number(targetWeight.trim().replace(',', '.')) : null;
    const updated = await saveGoal({
      exerciseId,
      targetScore: score != null && Number.isFinite(score) ? score : null,
      targetWeightKg: weight != null && Number.isFinite(weight) ? weight : null,
    });
    setGoals(updated);
    setTargetScore('');
    setTargetWeight('');
  }

  async function handleRemove(id: string) {
    setGoals(await removeGoal(id));
  }

  return (
    <View style={styles.container} accessibilityLabel="Metas pessoais">
      <Text style={styles.title}>Metas pessoais</Text>

      <View style={styles.picker}>
        {EXERCISES.map((exercise) => {
          const selected = exercise.id === exerciseId;
          return (
            <Pressable
              key={exercise.id}
              style={[styles.pickerItem, selected && styles.pickerItemSelected]}
              onPress={() => setExerciseId(exercise.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Exercício: ${exercise.name}`}
            >
              <Text style={[styles.pickerText, selected && styles.pickerTextSelected]}>{exercise.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="Meta de pontuação (%)"
        value={targetScore}
        onChangeText={setTargetScore}
        accessibilityLabel="Meta de pontuação em porcentagem, opcional"
      />
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="Meta de carga (kg)"
        value={targetWeight}
        onChangeText={setTargetWeight}
        accessibilityLabel="Meta de carga em quilogramas, opcional"
      />

      <Pressable style={styles.button} onPress={handleSave} accessibilityRole="button" accessibilityLabel="Salvar meta">
        <Text style={styles.buttonText}>Salvar meta</Text>
      </Pressable>

      <FlatList
        style={styles.list}
        data={goals}
        keyExtractor={(item) => item.exerciseId}
        renderItem={({ item }) => (
          <View style={styles.goalItem}>
            <View>
              <Text style={styles.goalTitle}>{exerciseName(item.exerciseId)}</Text>
              <Text style={styles.goalDetail}>
                {item.targetScore != null ? `Pontuação: ${item.targetScore}%` : ''}
                {item.targetScore != null && item.targetWeightKg != null ? ' · ' : ''}
                {item.targetWeightKg != null ? `Carga: ${item.targetWeightKg}kg` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => handleRemove(item.exerciseId)}
              accessibilityRole="button"
              accessibilityLabel={`Remover meta de ${exerciseName(item.exerciseId)}`}
            >
              <Text style={styles.removeText}>Remover</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 48, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerItem: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  pickerItemSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pickerText: { color: '#334155', fontSize: 13 },
  pickerTextSelected: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 16 },
  button: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { marginTop: 8 },
  goalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginBottom: 8,
  },
  goalTitle: { fontSize: 15, fontWeight: '600' },
  goalDetail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  removeText: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
});
