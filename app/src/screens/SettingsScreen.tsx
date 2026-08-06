import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { usePreferences } from '../hooks/usePreferences';
import type { CameraQuality } from '../services/preferencesStorage';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Settings'>;

const CAMERA_QUALITY_OPTIONS: { value: CameraQuality; label: string; hint: string }[] = [
  { value: 'high', label: 'Alta', hint: 'Mais precisão, mais bateria e memória' },
  { value: 'standard', label: 'Padrão', hint: 'Equilíbrio recomendado' },
  { value: 'saver', label: 'Economia', hint: 'Para aparelhos mais antigos' },
];

/**
 * Tela de Configurações (README.md): preferências locais persistidas via
 * AsyncStorage — não envolvem a API, então cada alteração é salva na hora.
 *
 * O estado vive no `PreferencesProvider` para que a mudança valha no app
 * inteiro imediatamente (o modo escuro repinta tudo sem sair da tela); antes
 * cada tela carregava as preferências por conta própria e uma alteração aqui só
 * aparecia na próxima montagem das outras.
 */
export function SettingsScreen({ navigation }: Props) {
  const { preferences, theme, updatePreferences } = usePreferences();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background }]}
      accessibilityLabel="Configurações"
    >
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Qualidade da câmera</Text>
      <View style={styles.optionsRow}>
        {CAMERA_QUALITY_OPTIONS.map((option) => {
          const selected = preferences.cameraQuality === option.value;
          return (
            <Pressable
              key={option.value}
              style={[
                styles.option,
                { borderColor: theme.border },
                selected && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => updatePreferences({ cameraQuality: option.value })}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Qualidade da câmera: ${option.label}. ${option.hint}`}
            >
              <Text style={[styles.optionText, { color: selected ? theme.onPrimary : theme.text }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: theme.muted }]}>
        {CAMERA_QUALITY_OPTIONS.find((option) => option.value === preferences.cameraQuality)?.hint}
      </Text>

      <ToggleRow
        label="Vibrar ao corrigir postura"
        value={preferences.vibrationFeedback}
        onChange={(value) => updatePreferences({ vibrationFeedback: value })}
        theme={theme}
      />
      <ToggleRow
        label="Modo escuro"
        value={preferences.darkMode}
        onChange={(value) => updatePreferences({ darkMode: value })}
        theme={theme}
      />
      <ToggleRow
        label="Modo daltonismo"
        value={preferences.colorBlindMode}
        onChange={(value) => updatePreferences({ colorBlindMode: value })}
        theme={theme}
      />
      <ToggleRow
        label="Alto contraste"
        value={preferences.highContrast}
        onChange={(value) => updatePreferences({ highContrast: value })}
        theme={theme}
      />
      {preferences.highContrast && preferences.darkMode && (
        <Text style={[styles.hint, { color: theme.muted }]}>
          Alto contraste tem prioridade sobre o modo escuro.
        </Text>
      )}
      <ToggleRow
        label="Fontes grandes"
        value={preferences.largeText}
        onChange={(value) => updatePreferences({ largeText: value })}
        theme={theme}
      />

      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('Calibration')}
        accessibilityRole="button"
        accessibilityLabel="Ajustar calibração corporal"
      >
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Calibração corporal</Text>
        <Text style={[styles.linkText, { color: theme.primary }]}>Ajustar</Text>
      </Pressable>

      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('Goals')}
        accessibilityRole="button"
        accessibilityLabel="Definir metas pessoais"
      >
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Metas pessoais</Text>
        <Text style={[styles.linkText, { color: theme.primary }]}>Definir</Text>
      </Pressable>
    </View>
  );
}

/** Extraído porque as seis linhas de switch eram idênticas exceto por rótulo e campo. */
function ToggleRow({
  label,
  value,
  onChange,
  theme,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  theme: { text: string };
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 20, paddingTop: 48 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, marginTop: -12 },
  optionsRow: { flexDirection: 'row', gap: 8 },
  option: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  optionText: { fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkText: { fontSize: 14, fontWeight: '600' },
});
