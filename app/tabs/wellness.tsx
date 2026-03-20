import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useWellnessHistory, WellnessHistoryDay, WellnessHistoryWorkoutLog } from '../../hooks/useWellnessHistory';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DayCard } from '../../components/history/DayCard';
import { isOlderThanThirtyDays } from '../../utils/dateHelpers';

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

  const renderDay = useCallback(({ item }: { item: WellnessHistoryDay }) => (
    <DayCard
      day={item}
      onEditWellness={() => router.push({ pathname: '/wellness_modal', params: { date: item.date } })}
      onDeleteWellness={() => handleDeleteWellness(item)}
      onAddTraining={() => router.push({ pathname: '/training_modal', params: { date: item.date } })}
      onEditWorkout={(workout) => router.push({ pathname: '/training_modal', params: { workoutId: String(workout.id) } })}
      onDeleteWorkout={(workout) => handleDeleteWorkout(item, workout)}
    />
  ), [handleDeleteWellness, handleDeleteWorkout, router]);

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
      <ConfirmDialog
        visible={confirmDialog !== null}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  flatList: { flex: 1 },
  content: { padding: 16, paddingBottom: 36, gap: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
  screenHeader: { marginBottom: 6, gap: 4 },
  screenTitle: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  screenSubtitle: { color: '#9a9a9a', fontSize: 14, lineHeight: 20 },
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
});
