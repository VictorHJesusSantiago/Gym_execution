import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, Share, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { deleteMyAccount, getMyProfile, updateMyProfile } from '../services/userService';
import { listAllMySessions, type TrainingSessionPublic } from '../services/sessionsService';
import { ApiError } from '../services/apiClient';
import { computeProfileStats, computeStreak, type ProfileStats } from '../services/profileStats';
import { computeAchievements, type Achievement } from '../services/achievements';
import { computePeriodReport, computeScoreSeries, type PeriodReport, type ScorePoint } from '../services/trainingReport';
import { sessionsToCSV } from '../services/exportSessions';
import { exerciseName } from '../services/exerciseCatalog';
import { useTheme } from '../hooks/usePreferences';
import type { ExperienceLevel, UserPublic } from '../services/authService';

const EXPERIENCE_LEVEL_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'Iniciante' },
  { value: 'intermediate', label: 'Intermediário' },
  { value: 'advanced', label: 'Avançado' },
];

const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

/** Converte um texto numérico (aceita vírgula) em número, ou `null` se vazio/inválido. */
function parseOptionalNumber(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Tela de Perfil (README.md): dados do usuário (GET/PUT /users/me),
 * estatísticas agregadas a partir do histórico (GET /sessions) e logout.
 */
export function ProfileScreen() {
  const { token, signOut } = useAuth();
  const theme = useTheme();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ trainingCount: 0, averageScore: null });
  const [streakDays, setStreakDays] = useState(0);
  const [sessions, setSessions] = useState<TrainingSessionPublic[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<PeriodReport>({ sessionsCount: 0, averageScore: null, totalWeightKg: 0 });
  const [scoreSeries, setScoreSeries] = useState<ScorePoint[]>([]);
  const [name, setName] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [profile, mySessions] = await Promise.all([getMyProfile(token), listAllMySessions(token)]);
      setUser(profile);
      setName(profile.name);
      setWeightInput(profile.weight_kg != null ? String(profile.weight_kg) : '');
      setHeightInput(profile.height_cm != null ? String(profile.height_cm) : '');
      setGoalInput(profile.goal ?? '');
      setExperienceLevel(profile.experience_level ?? null);
      setStats(computeProfileStats(mySessions.map((session) => session.score)));
      const streak = computeStreak(mySessions.map((session) => session.executed_at));
      setStreakDays(streak);
      setSessions(mySessions);
      setAchievements(computeAchievements(mySessions, streak));
      setWeeklyReport(computePeriodReport(mySessions, 7));
      setScoreSeries(computeScoreSeries(mySessions));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o perfil.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMyProfile(token, {
        name: name.trim(),
        weight_kg: parseOptionalNumber(weightInput),
        height_cm: parseOptionalNumber(heightInput),
        goal: goalInput.trim() || null,
        experience_level: experienceLevel,
      });
      setUser(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  }

  /**
   * Exclusão de conta (LGPD/GDPR). Confirmação obrigatória e explícita sobre o
   * que se perde: é irreversível e leva o histórico junto.
   */
  function handleDeleteAccount() {
    Alert.alert(
      'Excluir conta',
      'Isto apaga sua conta e TODO o histórico de treinos, de forma permanente. Não é possível desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir tudo',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteMyAccount(token);
              await signOut();
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Não foi possível excluir a conta.');
            }
          },
        },
      ]
    );
  }

  /** Compartilha o histórico em CSV via a folha de compartilhamento nativa (sem dependência nova). */
  async function handleExport() {
    const csv = sessionsToCSV(sessions, exerciseName);
    await Share.share({ title: 'Histórico de treinos', message: csv });
  }

  if (loading || !user) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
      accessibilityLabel="Perfil do usuário"
    >
      {editing ? (
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          placeholderTextColor={theme.muted}
          value={name}
          onChangeText={setName}
          placeholder="Nome"
          accessibilityLabel="Nome"
        />
      ) : (
        <Text style={[styles.name, { color: theme.text }]}>{user.name}</Text>
      )}
      <Text style={[styles.email, { color: theme.muted }]}>{user.email}</Text>

      {editing ? (
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Dados físicos</Text>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Peso (kg)</Text>
            <TextInput
              style={[styles.fieldInput, { color: theme.text, borderColor: theme.border }]}
              placeholderTextColor={theme.muted}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="numeric"
              placeholder="opcional"
              accessibilityLabel="Peso em quilogramas, opcional"
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Altura (cm)</Text>
            <TextInput
              style={[styles.fieldInput, { color: theme.text, borderColor: theme.border }]}
              placeholderTextColor={theme.muted}
              value={heightInput}
              onChangeText={setHeightInput}
              keyboardType="numeric"
              placeholder="opcional"
              accessibilityLabel="Altura em centímetros, opcional"
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Objetivo</Text>
            <TextInput
              style={[styles.fieldInput, { color: theme.text, borderColor: theme.border }]}
              placeholderTextColor={theme.muted}
              value={goalInput}
              onChangeText={setGoalInput}
              placeholder="ex.: ganhar massa"
              accessibilityLabel="Objetivo, opcional"
            />
          </View>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Nível de experiência</Text>
          <View style={styles.optionsRow}>
            {EXPERIENCE_LEVEL_OPTIONS.map((option) => {
              const selected = experienceLevel === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.option, { borderColor: theme.border }, selected && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                  onPress={() => setExperienceLevel(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Nível de experiência: ${option.label}`}
                >
                  <Text style={[styles.optionText, { color: selected ? theme.onPrimary : theme.text }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        (user.weight_kg != null || user.height_cm != null || user.goal || user.experience_level) && (
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Dados físicos</Text>
            {user.weight_kg != null && <Text style={[styles.sectionText, { color: theme.muted }]}>Peso: {user.weight_kg}kg</Text>}
            {user.height_cm != null && <Text style={[styles.sectionText, { color: theme.muted }]}>Altura: {user.height_cm}cm</Text>}
            {user.goal && <Text style={[styles.sectionText, { color: theme.muted }]}>Objetivo: {user.goal}</Text>}
            {user.experience_level && (
              <Text style={[styles.sectionText, { color: theme.muted }]}>Nível: {EXPERIENCE_LEVEL_LABELS[user.experience_level]}</Text>
            )}
          </View>
        )
      )}

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: theme.surface }]}>
          <Text style={[styles.statValue, { color: theme.accent }]}>{stats.trainingCount}</Text>
          <Text style={[styles.statLabel, { color: theme.muted }]}>Treinos realizados</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: theme.surface }]}>
          <Text style={[styles.statValue, { color: theme.accent }]}>{stats.averageScore !== null ? `${stats.averageScore}%` : '—'}</Text>
          <Text style={[styles.statLabel, { color: theme.muted }]}>Pontuação média</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: theme.surface }]}>
          <Text style={[styles.statValue, { color: theme.accent }]}>{streakDays}</Text>
          <Text style={[styles.statLabel, { color: theme.muted }]}>{streakDays === 1 ? 'dia seguido' : 'dias seguidos'}</Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Esta semana</Text>
        <Text style={[styles.sectionText, { color: theme.muted }]}>
          {weeklyReport.sessionsCount === 0
            ? 'Nenhum treino registrado nos últimos 7 dias.'
            : `${weeklyReport.sessionsCount} treino${weeklyReport.sessionsCount > 1 ? 's' : ''} · pontuação média ${weeklyReport.averageScore}% · ${weeklyReport.totalWeightKg}kg movimentados`}
        </Text>
      </View>

      {scoreSeries.length > 0 && (
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Evolução da pontuação</Text>
          <View style={styles.chart}>
            {scoreSeries.map((point, index) => (
              <View key={index} style={styles.chartBarContainer}>
                <View style={[styles.chartBar, { height: `${Math.max(point.score, 2)}%`, backgroundColor: theme.accent }]} />
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Conquistas</Text>
        {achievements.map((achievement) => (
          <Text
            key={achievement.id}
            style={[
              achievement.unlocked ? styles.achievementUnlocked : styles.achievementLocked,
              { color: achievement.unlocked ? theme.positive : theme.muted },
            ]}
          >
            {achievement.unlocked ? '[OK] ' : '[ ] '}
            {achievement.title}
          </Text>
        ))}
      </View>

      {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

      {editing ? (
        <Pressable
          style={[styles.button, { backgroundColor: saving ? theme.disabled : theme.primary }]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Salvar perfil"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{saving ? 'Salvando...' : 'Salvar'}</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => setEditing(true)}
          accessibilityRole="button"
          accessibilityLabel="Editar perfil"
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Editar perfil</Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.secondaryButton, { borderColor: theme.danger }]}
        onPress={handleExport}
        accessibilityRole="button"
        accessibilityLabel="Exportar histórico em CSV"
      >
        <Text style={[styles.secondaryButtonText, { color: theme.danger }]}>Exportar histórico (CSV)</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, { borderColor: theme.danger }]}
        onPress={signOut}
        accessibilityRole="button"
        accessibilityLabel="Sair da conta"
      >
        <Text style={[styles.secondaryButtonText, { color: theme.danger }]}>Sair</Text>
      </Pressable>

      <Pressable
        onPress={handleDeleteAccount}
        accessibilityRole="button"
        accessibilityLabel="Excluir conta e todo o histórico permanentemente"
        hitSlop={8}
      >
        <Text style={[styles.deleteAccountLink, { color: theme.muted }]}>Excluir minha conta</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 24, gap: 12, paddingTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 14, marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 18, minWidth: 220, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  statBox: { alignItems: 'center', borderRadius: 8, padding: 16, minWidth: 100 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  section: { width: '100%', maxWidth: 320, borderRadius: 8, padding: 16, gap: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sectionText: { fontSize: 13 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    flex: 1,
    maxWidth: 160,
    textAlign: 'right',
  },
  optionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  option: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionText: { fontSize: 13 },
  chart: { height: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 8 },
  chartBarContainer: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  chartBar: { borderRadius: 4, minHeight: 2 },
  achievementUnlocked: { fontSize: 13, fontWeight: '600' },
  achievementLocked: { fontSize: 13 },
  error: { fontSize: 14 },
  button: { paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8, marginTop: 8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  secondaryButton: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8 },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
  deleteAccountLink: { fontSize: 13, textDecorationLine: 'underline', marginTop: 8, marginBottom: 16 },
});
