import React from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WellnessHistoryDay, WellnessHistoryWorkoutLog } from '../../hooks/useWellnessHistory';
import { formatHistoryDate } from '../../utils/dateHelpers';
import { WorkoutCard } from './WorkoutCard';

function formatMetricValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return '--';
  return `${value}${unit}`;
}

interface DayCardProps {
  day: WellnessHistoryDay;
  onEditWellness: () => void;
  onDeleteWellness: () => void;
  onAddTraining: () => void;
  onEditWorkout: (workout: WellnessHistoryWorkoutLog) => void;
  onDeleteWorkout: (workout: WellnessHistoryWorkoutLog) => void;
}

export function DayCard({
  day,
  onEditWellness,
  onDeleteWellness,
  onAddTraining,
  onEditWorkout,
  onDeleteWorkout,
}: DayCardProps) {
  const wellness = day.wellnessLog;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.dayLabel}>{formatHistoryDate(day.date)}</Text>
          <Text style={styles.dayDate}>{day.date}</Text>
        </View>

        {wellness ? (
          <View style={styles.inlineActions}>
            <Pressable style={styles.actionButton} onPress={onEditWellness}>
              <Ionicons name="create-outline" size={16} color="#9ec5ff" />
              <Text style={styles.actionButtonText}>Bearbeiten</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.deleteActionButton]} onPress={onDeleteWellness}>
              <Ionicons name="trash-outline" size={16} color="#ff9d9d" />
              <Text style={[styles.actionButtonText, styles.deleteActionButtonText]}>Löschen</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {wellness ? (
        <>
          <View style={styles.metricsRow}>
            <View style={[styles.metricPill, styles.readinessPill]}>
              <Text style={styles.metricLabel}>Readiness</Text>
              <Text style={styles.metricValue}>{day.readinessScore ?? '--'}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>HRV</Text>
              <Text style={styles.metricValue}>{formatMetricValue(wellness.hrv, ' ms')}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Schlaf</Text>
              <Text style={styles.metricValue}>{formatMetricValue(wellness.sleep_hours, ' h')}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>RHR</Text>
              <Text style={styles.metricValue}>{formatMetricValue(wellness.resting_hr, ' bpm')}</Text>
            </View>
          </View>

          <View style={styles.flagRow}>
            <View style={[styles.flagChip, wellness.is_sick ? styles.flagChipAlert : styles.flagChipMuted]}>
              <Text style={styles.flagText}>{wellness.is_sick ? 'Krank' : 'Nicht krank'}</Text>
            </View>
            <View style={[styles.flagChip, wellness.is_injured ? styles.flagChipWarning : styles.flagChipMuted]}>
              <Text style={styles.flagText}>{wellness.is_injured ? 'Verletzt' : 'Nicht verletzt'}</Text>
            </View>
          </View>
        </>
      ) : (
        <TouchableOpacity style={styles.emptyWellnessBox} onPress={onEditWellness}>
          <Ionicons name="heart-outline" size={18} color="#888888" />
          <Text style={styles.emptyWellnessText}>Kein Wellness-Log für diesen Tag. Jetzt nachtragen.</Text>
        </TouchableOpacity>
      )}

      <View style={styles.trainingSectionHeader}>
        <Text style={styles.trainingSectionTitle}>Trainings-Logs</Text>
        <TouchableOpacity style={styles.addTrainingButton} onPress={onAddTraining}>
          <Ionicons name="add-circle-outline" size={16} color="#ffffff" />
          <Text style={styles.addTrainingButtonText}>Neu</Text>
        </TouchableOpacity>
      </View>

      {day.trainingLogs.length > 0 ? (
        <View style={styles.trainingList}>
          {day.trainingLogs.map((workout) => (
            <WorkoutCard
              key={String(workout.id)}
              workout={workout}
              onEdit={() => onEditWorkout(workout)}
              onDelete={() => onDeleteWorkout(workout)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyTrainingBox}>
          <Text style={styles.emptyTrainingText}>Kein Training geloggt.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2c2c2c',
    gap: 14,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  dayLabel: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  dayDate: { color: '#888888', fontSize: 12, marginTop: 2 },
  inlineActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1f2a4a',
    borderWidth: 1,
    borderColor: '#355793',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  deleteActionButton: { backgroundColor: '#412024', borderColor: '#70313b' },
  actionButtonText: { color: '#9ec5ff', fontSize: 12, fontWeight: '700' },
  deleteActionButtonText: { color: '#ff9d9d' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricPill: {
    minWidth: '47%',
    flex: 1,
    backgroundColor: '#242424',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2f2f2f',
    gap: 4,
  },
  readinessPill: { backgroundColor: '#172838', borderColor: '#234764' },
  metricLabel: { color: '#8d8d8d', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  metricValue: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  flagRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  flagChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  flagChipMuted: { backgroundColor: '#242424', borderColor: '#333333' },
  flagChipAlert: { backgroundColor: '#3a1d1d', borderColor: '#8a3d3d' },
  flagChipWarning: { backgroundColor: '#3b2d17', borderColor: '#8a6731' },
  flagText: { color: '#f2f2f2', fontSize: 12, fontWeight: '700' },
  emptyWellnessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#242424',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyWellnessText: { color: '#9a9a9a', fontSize: 13, fontWeight: '500' },
  trainingSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trainingSectionTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  addTrainingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#5a3fb3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addTrainingButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  trainingList: { gap: 8 },
  emptyTrainingBox: {
    backgroundColor: '#121212',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#242424',
  },
  emptyTrainingText: { color: '#787878', fontSize: 13, fontWeight: '500' },
});
