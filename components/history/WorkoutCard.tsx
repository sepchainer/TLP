import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WellnessHistoryWorkoutLog } from '../../hooks/useWellnessHistory';
import { getWorkoutTypeLabel } from '../../lib/workoutType';

interface WorkoutCardProps {
  workout: WellnessHistoryWorkoutLog;
  onEdit: () => void;
  onDelete: () => void;
}

export function WorkoutCard({ workout, onEdit, onDelete }: WorkoutCardProps) {
  const workoutTypes = Array.isArray(workout.workout_types) ? workout.workout_types : [];

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.metaBlock}>
          <Text style={styles.title}>
            {workoutTypes.length > 0
              ? workoutTypes.map((t) => getWorkoutTypeLabel(t)).join(' · ')
              : 'Training'}
          </Text>
          <Text style={styles.metaText}>
            {`${workout.duration_minutes ?? '--'} min | Last ${workout.calculated_load ?? '--'} pts | RPE ${workout.muscular_effort ?? '--'}/${workout.respiration_effort ?? '--'}`}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.editButton} onPress={onEdit}>
            <Ionicons name="create-outline" size={16} color="#9ec5ff" />
          </Pressable>
          <Pressable style={[styles.editButton, styles.deleteButton]} onPress={onDelete}>
            <Ionicons name="trash-outline" size={16} color="#ff9d9d" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metaBlock: { flex: 1, gap: 4 },
  title: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  metaText: { color: '#9a9a9a', fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2a4a',
    borderWidth: 1,
    borderColor: '#355793',
  },
  deleteButton: { backgroundColor: '#412024', borderColor: '#70313b' },
});
