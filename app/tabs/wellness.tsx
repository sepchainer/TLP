import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useWellnessHistory, WellnessHistoryDay, WellnessHistoryWorkoutLog } from '../../hooks/useWellnessHistory';

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function formatHistoryDate(date: string): string {
  const normalized = parseIsoDate(date);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (normalized.toDateString() === today.toDateString()) {
    return 'Heute';
  }

  if (normalized.toDateString() === yesterday.toDateString()) {
    return 'Gestern';
  }

  return normalized.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatMetricValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) {
    return '--';
  }

  return `${value}${unit}`;
}

const WORKOUT_TYPE_LABELS_BY_INDEX: Record<number, string> = {
  0: 'Kraft',
  1: 'Cardio',
  2: 'Plyo',
  3: 'Spiel',
  4: 'Drills',
  5: 'Wettkampf',
  6: 'Warm-up',
  7: 'Mobility',
  8: 'Dehnen',
  9: 'Regeneration',
  10: 'Prehab',
};

const WORKOUT_TYPE_LABELS_BY_NAME: Record<string, string> = {
  KRAFTTRAINING: 'Kraft',
  CARDIO: 'Cardio',
  PLYOMETRICS: 'Plyo',
  SPIEL_SIMULATION: 'Spiel',
  TECHNISCHE_DRILLS: 'Drills',
  WETTKAMPF: 'Wettkampf',
  AUFWAERMEN: 'Warm-up',
  MOBILITY: 'Mobility',
  DEHNEN: 'Dehnen',
  REGENERATION: 'Regeneration',
  PREHAB: 'Prehab',
};

function getWorkoutTypeLabel(type: string | number): string {
  const asNumber = Number(type);
  if (!Number.isNaN(asNumber) && asNumber in WORKOUT_TYPE_LABELS_BY_INDEX) {
    return WORKOUT_TYPE_LABELS_BY_INDEX[asNumber]!;
  }
  return WORKOUT_TYPE_LABELS_BY_NAME[String(type)] ?? String(type);
}

function isOlderThanThirtyDays(date: string): boolean {
  const current = new Date();
  current.setHours(12, 0, 0, 0);
  const target = parseIsoDate(date);
  const diffMs = current.getTime() - target.getTime();
  return diffMs / (1000 * 60 * 60 * 24) > 30;
}

export default function WellnessScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useWellnessHistory();

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const days = useMemo(() => data?.pages.flatMap((page) => page.days) ?? [], [data]);

  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const invalidateHistory = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wellnessHistory'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] }),
    ]);
  }, [queryClient]);

  const executeDeleteWellness = useCallback(async (day: WellnessHistoryDay) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Nicht eingeloggt');

      const { error: deleteError } = await supabase
        .from('wellness_logs')
        .delete()
        .eq('user_id', authData.user.id)
        .eq('date', day.date);

      if (deleteError) throw deleteError;

      const { error: scoreDeleteError } = await supabase
        .from('readiness_scores')
        .delete()
        .eq('user_id', authData.user.id)
        .eq('date', day.date);

      if (scoreDeleteError) throw scoreDeleteError;

      await invalidateHistory();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Löschen fehlgeschlagen.');
    }
  }, [invalidateHistory]);

  const handleDeleteWellness = useCallback((day: WellnessHistoryDay) => {
    if (!day.wellnessLog) return;
    const isOldEntry = isOlderThanThirtyDays(day.date);
    setConfirmDialog({
      title: 'Wellness löschen',
      message: isOldEntry
        ? 'Dieser Eintrag beeinflusst nicht mehr die aktuelle Readiness, kann aber historische Scores verändern. Wirklich löschen?'
        : 'Wellness-Log wirklich löschen?',
      onConfirm: () => void executeDeleteWellness(day),
    });
  }, [executeDeleteWellness]);

  const executeDeleteWorkout = useCallback(async (workout: WellnessHistoryWorkoutLog) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Nicht eingeloggt');

      if (workout.id === undefined || workout.id === null) {
        throw new Error('Training kann ohne ID nicht gelöscht werden.');
      }

      const { error: deleteError } = await supabase
        .from('workout_logs')
        .delete()
        .eq('user_id', authData.user.id)
        .eq('id', workout.id);

      if (deleteError) throw deleteError;

      await invalidateHistory();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Löschen fehlgeschlagen.');
    }
  }, [invalidateHistory]);

  const handleDeleteWorkout = useCallback((day: WellnessHistoryDay, workout: WellnessHistoryWorkoutLog) => {
    const isOldEntry = isOlderThanThirtyDays(day.date);
    setConfirmDialog({
      title: 'Training löschen',
      message: isOldEntry
        ? 'Dieses Training beeinflusst nicht mehr die aktuelle Readiness, kann aber historische Scores verändern. Wirklich löschen?'
        : 'Trainings-Log wirklich löschen?',
      onConfirm: () => void executeDeleteWorkout(workout),
    });
  }, [executeDeleteWorkout]);

  const renderWorkout = useCallback((day: WellnessHistoryDay, workout: WellnessHistoryWorkoutLog) => {
    const workoutTypes = Array.isArray(workout.workout_types) ? workout.workout_types : [];

    return (
      <View key={String(workout.id)} style={styles.workoutCard}>
        <View style={styles.workoutTopRow}>
          <View style={styles.workoutMetaBlock}>
            <Text style={styles.workoutTitle}>
              {workoutTypes.length > 0
                ? workoutTypes.map((type) => getWorkoutTypeLabel(type)).join(' · ')
                : 'Training'}
            </Text>
            <Text style={styles.workoutMetaText}>
              {`${workout.duration_minutes ?? '--'} min | Last ${workout.calculated_load ?? '--'} pts | RPE ${workout.muscular_effort ?? '--'}/${workout.respiration_effort ?? '--'}`}
            </Text>
          </View>

          <View style={styles.inlineActions}>
            <Pressable
              style={styles.smallActionButton}
              onPress={() => router.push({ pathname: '/training_modal', params: { workoutId: String(workout.id) } })}
            >
              <Ionicons name="create-outline" size={16} color="#9ec5ff" />
            </Pressable>
            <Pressable
              style={[styles.smallActionButton, styles.deleteActionButton]}
              onPress={() => handleDeleteWorkout(day, workout)}
            >
              <Ionicons name="trash-outline" size={16} color="#ff9d9d" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }, [handleDeleteWorkout, router]);

  const renderDay = useCallback(({ item }: { item: WellnessHistoryDay }) => {
    const wellness = item.wellnessLog;

    return (
      <View style={styles.dayCard}>
        <View style={styles.dayHeader}>
          <View>
            <Text style={styles.dayLabel}>{formatHistoryDate(item.date)}</Text>
            <Text style={styles.dayDate}>{item.date}</Text>
          </View>

          {wellness ? (
            <View style={styles.inlineActions}>
              <Pressable
                style={styles.headerActionButton}
                onPress={() => router.push({ pathname: '/wellness_modal', params: { date: item.date } })}
              >
                <Ionicons name="create-outline" size={16} color="#9ec5ff" />
                <Text style={styles.headerActionText}>Bearbeiten</Text>
              </Pressable>
              <Pressable
                style={[styles.headerActionButton, styles.deleteHeaderActionButton]}
                onPress={() => handleDeleteWellness(item)}
              >
                <Ionicons name="trash-outline" size={16} color="#ff9d9d" />
                <Text style={[styles.headerActionText, styles.deleteHeaderActionText]}>Löschen</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {wellness ? (
          <>
            <View style={styles.metricsRow}>
              <View style={[styles.metricPill, styles.readinessPill]}>
                <Text style={styles.metricLabel}>Readiness</Text>
                <Text style={styles.metricValue}>{item.readinessScore ?? '--'}</Text>
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
          <TouchableOpacity
            style={styles.emptyWellnessBox}
            onPress={() => router.push({ pathname: '/wellness_modal', params: { date: item.date } })}
          >
            <Ionicons name="heart-outline" size={18} color="#888888" />
            <Text style={styles.emptyWellnessText}>Kein Wellness-Log für diesen Tag. Jetzt nachtragen.</Text>
          </TouchableOpacity>
        )}

        <View style={styles.trainingSectionHeader}>
          <Text style={styles.trainingSectionTitle}>Trainings-Logs</Text>
          <TouchableOpacity
            style={styles.addTrainingButton}
            onPress={() => router.push({ pathname: '/training_modal', params: { date: item.date } })}
          >
            <Ionicons name="add-circle-outline" size={16} color="#ffffff" />
            <Text style={styles.addTrainingButtonText}>Neu</Text>
          </TouchableOpacity>
        </View>

        {item.trainingLogs.length > 0 ? (
          item.trainingLogs.map((workout) => renderWorkout(item, workout))
        ) : (
          <View style={styles.emptyTrainingBox}>
            <Text style={styles.emptyTrainingText}>Kein Training geloggt.</Text>
          </View>
        )}
      </View>
    );
  }, [handleDeleteWellness, renderWorkout, router]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={days}
        keyExtractor={(item) => item.date}
        renderItem={renderDay}
        contentContainerStyle={styles.content}
        style={styles.flatList}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isFetchingNextPage}
            onRefresh={() => void refetch()}
            tintColor="#9ec5ff"
            progressBackgroundColor="#1a1a1a"
            colors={['#9ec5ff']}
          />
        }
      ListHeaderComponent={
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>Wellness Historie</Text>
          <Text style={styles.screenSubtitle}>Letzte 5 Tage gruppiert nach Tagesstatus und Trainings.</Text>
        </View>
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {hasNextPage ? (
            <TouchableOpacity
              style={[styles.loadMoreButton, isFetchingNextPage && styles.loadMoreButtonDisabled]}
              onPress={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loadMoreText}>Weitere 5 Tage laden</Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.footerHint}>Keine älteren Einträge gefunden.</Text>
          )}
        </View>
      }
    />
      <Modal
        visible={confirmDialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDialog(null)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>{confirmDialog?.title}</Text>
            <Text style={styles.dialogMessage}>{confirmDialog?.message}</Text>
            <View style={styles.dialogActions}>
              <Pressable style={styles.dialogCancelButton} onPress={() => setConfirmDialog(null)}>
                <Text style={styles.dialogCancelText}>Abbrechen</Text>
              </Pressable>
              <Pressable
                style={styles.dialogDeleteButton}
                onPress={() => {
                  confirmDialog?.onConfirm();
                  setConfirmDialog(null);
                }}
              >
                <Text style={styles.dialogDeleteText}>Löschen</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 16, paddingBottom: 36, gap: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
  screenHeader: { marginBottom: 6, gap: 4 },
  screenTitle: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  screenSubtitle: { color: '#9a9a9a', fontSize: 14, lineHeight: 20 },
  dayCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2c2c2c',
    gap: 14,
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  dayLabel: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  dayDate: { color: '#888888', fontSize: 12, marginTop: 2 },
  inlineActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  headerActionButton: {
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
  deleteHeaderActionButton: { backgroundColor: '#412024', borderColor: '#70313b' },
  headerActionText: { color: '#9ec5ff', fontSize: 12, fontWeight: '700' },
  deleteHeaderActionText: { color: '#ff9d9d' },
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
  workoutCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 8,
  },
  workoutTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  workoutMetaBlock: { flex: 1, gap: 4 },
  workoutTitle: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  workoutMetaText: { color: '#9a9a9a', fontSize: 12, lineHeight: 18 },
  smallActionButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2a4a',
    borderWidth: 1,
    borderColor: '#355793',
  },
  deleteActionButton: { backgroundColor: '#412024', borderColor: '#70313b' },
  workoutNotes: { color: '#d0d0d0', fontSize: 13, lineHeight: 19 },
  emptyTrainingBox: {
    backgroundColor: '#121212',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#242424',
  },
  emptyTrainingText: { color: '#787878', fontSize: 13, fontWeight: '500' },
  footer: { paddingTop: 12, paddingBottom: 20, alignItems: 'center' },
  loadMoreButton: {
    minWidth: 220,
    backgroundColor: '#007AFF',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  loadMoreButtonDisabled: { opacity: 0.7 },
  loadMoreText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  footerHint: { color: '#777777', fontSize: 13 },
  flatList: { flex: 1 },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2c2c2c',
    gap: 12,
    width: '100%',
  },
  dialogTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  dialogMessage: { color: '#9a9a9a', fontSize: 14, lineHeight: 21 },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dialogCancelButton: {
    flex: 1,
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  dialogCancelText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  dialogDeleteButton: {
    flex: 1,
    backgroundColor: '#412024',
    borderWidth: 1,
    borderColor: '#70313b',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  dialogDeleteText: { color: '#ff9d9d', fontSize: 15, fontWeight: '700' },
});
