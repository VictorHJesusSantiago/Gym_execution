import { useCallback, useState } from 'react';
import { View, Text, Pressable, Switch, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import {
  loadPreferences,
  savePreferences,
  DEFAULT_PREFERENCES,
  type Preferences,
  type CameraQuality,
} from '../services/preferencesStorage';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Settings'>;

const CAMERA_QUALITY_OPTIONS: { value: CameraQuality; label: string }[] = [
  { value: 'high', label: 'Alta' },
  { value: 'standard', label: 'Padrão' },
  { value: 'saver', label: 'Economia' },
];

/**
 * Tela de Configurações (README.md): preferências locais persistidas via
 * AsyncStorage — não envolvem a API, então cada alteração é salva na hora.
 */
export function SettingsScreen({ navigation }: Props) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadPreferences().then((loaded) => {
        if (active) {
          setPreferences(loaded);
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }, [])
  );

  function update(partial: Partial<Preferences>) {
    const next = { ...preferences, ...partial };
    setPreferences(next);
    savePreferences(next).catch(() => {
      // Preferência local: falha ao persistir não deve travar a navegação.
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityLabel="Configurações">
      <Text style={styles.sectionTitle}>Qualidade da câmera</Text>
      <View style={styles.optionsRow}>
        {CAMERA_QUALITY_OPTIONS.map((option) => {
          const selected = preferences.cameraQuality === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => update({ cameraQuality: option.value })}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Qualidade da câmera: ${option.label}`}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <Text style={styles.sectionTitle}>Som de feedback</Text>
        <Switch
          value={preferences.soundFeedback}
          onValueChange={(value) => update({ soundFeedback: value })}
          accessibilityLabel="Som de feedback"
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.sectionTitle}>Modo escuro</Text>
        <Switch
          value={preferences.darkMode}
          onValueChange={(value) => update({ darkMode: value })}
          accessibilityLabel="Modo escuro"
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.sectionTitle}>Modo daltonismo</Text>
        <Switch
          value={preferences.colorBlindMode}
          onValueChange={(value) => update({ colorBlindMode: value })}
          accessibilityLabel="Modo daltonismo"
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.sectionTitle}>Alto contraste</Text>
        <Switch
          value={preferences.highContrast}
          onValueChange={(value) => update({ highContrast: value })}
          accessibilityLabel="Alto contraste"
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.sectionTitle}>Fontes grandes</Text>
        <Switch
          value={preferences.largeText}
          onValueChange={(value) => update({ largeText: value })}
          accessibilityLabel="Fontes grandes"
        />
      </View>

      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('Calibration')}
        accessibilityRole="button"
        accessibilityLabel="Ajustar calibração corporal"
      >
        <Text style={styles.sectionTitle}>Calibração corporal</Text>
        <Text style={styles.linkText}>Ajustar</Text>
      </Pressable>

      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('Goals')}
        accessibilityRole="button"
        accessibilityLabel="Definir metas pessoais"
      >
        <Text style={styles.sectionTitle}>Metas pessoais</Text>
        <Text style={styles.linkText}>Definir</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 20, paddingTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  optionsRow: { flexDirection: 'row', gap: 8 },
  option: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  optionSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  optionText: { color: '#334155', fontSize: 14 },
  optionTextSelected: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
});
