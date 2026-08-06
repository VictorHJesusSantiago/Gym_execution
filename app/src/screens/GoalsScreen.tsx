import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { exerciseName } from '../services/exerciseCatalog';
import { useExerciseCatalog } from '../hooks/useExerciseCatalog';
import { useTheme } from '../hooks/usePreferences';
import { loadGoals, removeGoal, saveGoal, type PersonalGoal } from '../services/personalGoals';

/**
 * Tela de Metas pessoais (README.md — "Progresso e métricas"): define, por
 * exercício, uma meta de pontuação e/ou de carga, persistida localmente
 * (mesmo padrão de `bodyCalibration`). O progresso é exibido na tela de
 * Resultado (ver `ResultScreen`).
 */
export function GoalsScreen() {
  const theme = useTheme();
  const { exercises } = useExerciseCatalog();
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  // `exercises` nunca é vazio (o hook parte do catálogo embutido), mas o
  // fallback para '' evita um crash de índice caso um dia passe a ser.
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? '');
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
    <View style={[styles.container, { backgroundColor: theme.background }]} accessibilityLabel="Metas pessoais">
      <Text style={[styles.title, { color: theme.text }]}>Metas pessoais</Text>

      <View style={styles.picker}>
        {exercises.map((exercise) => {
          const selected = exercise.id === exerciseId;
          return (
            <Pressable
              key={exercise.id}
              style={[styles.pickerItem, { borderColor: theme.border }, selected && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setExerciseId(exercise.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Exercício: ${exercise.name}`}
            >
              <Text style={[styles.pickerText, { color: selected ? theme.onPrimary : theme.text }]}>{exercise.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        placeholderTextColor={theme.muted}
        keyboardType="numeric"
        placeholder="Meta de pontuação (%)"
        value={targetScore}
        onChangeText={setTargetScore}
        accessibilityLabel="Meta de pontuação em porcentagem, opcional"
      />
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        placeholderTextColor={theme.muted}
        keyboardType="numeric"
        placeholder="Meta de carga (kg)"
        value={targetWeight}
        onChangeText={setTargetWeight}
        accessibilityLabel="Meta de carga em quilogramas, opcional"
      />

      <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={handleSave} accessibilityRole="button" accessibilityLabel="Salvar meta">
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Salvar meta</Text>
      </Pressable>

      <FlatList
        style={styles.list}
        data={goals}
        keyExtractor={(item) => item.exerciseId}
        renderItem={({ item }) => (
          <View style={[styles.goalItem, { backgroundColor: theme.surface }]}>
            <View>
              <Text style={[styles.goalTitle, { color: theme.text }]}>{exerciseName(item.exerciseId, exercises)}</Text>
              <Text style={[styles.goalDetail, { color: theme.muted }]}>
                {item.targetScore != null ? `Pontuação: ${item.targetScore}%` : ''}
                {item.targetScore != null && item.targetWeightKg != null ? ' · ' : ''}
                {item.targetWeightKg != null ? `Carga: ${item.targetWeightKg}kg` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => handleRemove(item.exerciseId)}
              accessibilityRole="button"
              accessibilityLabel={`Remover meta de ${exerciseName(item.exerciseId, exercises)}`}
            >
              <Text style={[styles.removeText, { color: theme.danger }]}>Remover</Text>
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
  pickerItem: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  pickerText: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  button: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  list: { marginTop: 8 },
  goalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  goalTitle: { fontSize: 15, fontWeight: '600' },
  goalDetail: { fontSize: 13, marginTop: 2 },
  removeText: { fontSize: 14, fontWeight: '600' },
});
