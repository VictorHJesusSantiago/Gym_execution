import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { EXERCISES } from '../services/exerciseCatalog';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'ExerciseList'>;

export function ExerciseListScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <FlatList
        data={EXERCISES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.item}
            onPress={() => navigation.navigate('Execution', { exerciseId: item.id })}
          >
            <Text style={styles.itemTitle}>{item.name}</Text>
            <Text style={styles.itemSubtitle}>{item.muscleGroup}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  item: { padding: 16, borderRadius: 8, backgroundColor: '#f1f5f9', marginBottom: 12 },
  itemTitle: { fontSize: 18, fontWeight: '600' },
  itemSubtitle: { fontSize: 14, color: '#64748b' },
});
