import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useDashboardData } from '../../hooks/useDashboardData';
import { ReadinessGauge } from '../../components/dashboard/ReadinessGauge';
import { StatCard } from '../../components/dashboard/StatCard';
import { formatGermanDate } from '../../utils/dateHelpers';

const IGNORED_WORKOUTS_KEY_PREFIX = 'fitbit_ignored_workouts';

function getIgnoredKey(userId: string, date: string): string {
  return `${IGNORED_WORKOUTS_KEY_PREFIX}:${userId}:${date}`;
}

function formatWorkoutTime(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  // isLoading: Erster Load (keine Daten im Cache)
  // isRefetching: Update im Hintergrund
  const { data, isLoading, refetch } = useDashboardData();
  const [selectedDay, setSelectedDay] = useState<{date: string, load: number} | null>(null);
  const [ignoredWorkoutIds, setIgnoredWorkoutIds] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    async function loadIgnoredIds() {
      if (!data?.userId || !data?.today) {
        setIgnoredWorkoutIds([]);
        return;
      }

      try {
        const key = getIgnoredKey(data.userId, data.today);
        const raw = await SecureStore.getItemAsync(key);
        if (!raw) {
          setIgnoredWorkoutIds([]);
          return;
        }

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setIgnoredWorkoutIds(parsed.filter((id) => typeof id === 'string'));
          return;
        }

        setIgnoredWorkoutIds([]);
      } catch {
        setIgnoredWorkoutIds([]);
      }
    }

    loadIgnoredIds();
  }, [data?.userId, data?.today]);

  const visibleFitbitWorkouts = useMemo(() => {
    if (!data?.fitbitWorkouts) return [];
    const linkedIds = Array.isArray(data.linkedFitbitWorkoutIds) ? data.linkedFitbitWorkoutIds : [];

    return data.fitbitWorkouts.filter((workout) => {
      return !ignoredWorkoutIds.includes(workout.fitbitLogId) && !linkedIds.includes(workout.fitbitLogId);
    });
  }, [data?.fitbitWorkouts, data?.linkedFitbitWorkoutIds, ignoredWorkoutIds]);

  async function handleIgnoreWorkout(fitbitLogId: string) {
    if (!data?.userId || !data?.today) return;

    const next = Array.from(new Set([...ignoredWorkoutIds, fitbitLogId]));
    setIgnoredWorkoutIds(next);

    try {
      const key = getIgnoredKey(data.userId, data.today);
      await SecureStore.setItemAsync(key, JSON.stringify(next));
    } catch {
      // Ignore persistence failures to keep UI responsive.
    }
  }

  function handleLinkWorkout(workout: any) {
    const startTime = formatWorkoutTime(workout.startTime);
    const durationMinutes = Math.max(1, Math.round(workout.durationMinutes || 0));
    const prefillNotes = `Fitbit: ${workout.activityName} | Start: ${startTime}`;

    router.push({
      pathname: '/training_modal',
      params: {
        duration: String(durationMinutes),
        fitbitStartTime: workout.startTime,
        fitbitLogId: workout.fitbitLogId,
        prefillNotes,
      },
    });
  }

  if (isLoading) return (
    <View style={styles.centered}><ActivityIndicator size="large" color="#007AFF" /></View>
  );

  // Falls mal was schiefgeht (User offline etc.)
  if (!data) return <View style={styles.centered}><Text>Fehler beim Laden.</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Pressable onPress={() => setSelectedDay(null)} style={{ flex: 1 }}>
        <Text style={styles.dateText}>{data.formattedDate}</Text>

        {/* Status Badge */}
        <View style={styles.statusRow}>
           <View style={[styles.badge, data.fitbitData?.hrv ? styles.badgeSuccess : styles.badgeWait]}>
             <Ionicons name={data.fitbitData?.hrv ? "checkmark-circle" : "time"} size={14} color={data.fitbitData?.hrv ? "#2e7d32" : "#a66a00"} />
             <Text style={[styles.badgeText, { color: data.fitbitData?.hrv ? "#2e7d32" : "#a66a00" }]}>
               {data.fitbitData?.hrv ? "Fitbit Daten bereit" : "Sync ausstehend..."}
             </Text>
           </View>
        </View>
        
        <View style={styles.mainContent}>
          <ReadinessGauge score={data.readinessScore} />
        </View>

        <View style={styles.fitbitWorkoutSection}>
          <Text style={styles.fitbitSectionTitle}>Trainings von deiner Uhr</Text>

          {visibleFitbitWorkouts.length === 0 ? (
            <View style={styles.fitbitEmptyCard}>
              <Ionicons name="watch-outline" size={18} color="#888888" />
              <Text style={styles.fitbitEmptyText}>Keine offenen Fitbit-Trainings von heute.</Text>
            </View>
          ) : (
            visibleFitbitWorkouts.map((workout: any) => (
              <View key={workout.fitbitLogId} style={styles.fitbitWorkoutCard}>
                <View style={styles.fitbitWorkoutInfo}>
                  <Text style={styles.fitbitWorkoutName}>{workout.activityName}</Text>
                  <Text style={styles.fitbitWorkoutMeta}>
                    {formatWorkoutTime(workout.startTime)} Uhr | {Math.round(workout.durationMinutes)} min
                  </Text>
                </View>

                <View style={styles.fitbitWorkoutActions}>
                  <TouchableOpacity style={styles.ignoreButton} onPress={() => handleIgnoreWorkout(workout.fitbitLogId)}>
                    <Text style={styles.ignoreButtonText}>Ignorieren</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.linkButton} onPress={() => handleLinkWorkout(workout)}>
                    <Text style={styles.linkButtonText}>Link Training</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Buttons nutzen data.hasLoggedToday */}
        <View style={styles.actionContainer}>
          {!data.hasLoggedToday ? (
            <TouchableOpacity style={styles.logButton} onPress={() => router.push('/wellness_modal')}>
              <Ionicons name="add-circle-outline" size={24} color="white" />
              <Text style={styles.logButtonText}>Wellness Loggen</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.completedBox}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.completedText}>Wellness erledigt</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.logButton, styles.trainingButton]} onPress={() => router.push('/training_modal')}>
            <Ionicons name="fitness-outline" size={24} color="white" />
            <Text style={styles.logButtonText}>Training loggen</Text>
          </TouchableOpacity>
        </View>

        {/* Trend Card nutzt data.weeklyLoadData etc. */}
        <View style={styles.trendCard}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.trendHeader}>
              <View>
                <Text style={styles.trendTitle}>Wochen-Belastung</Text>
                <View style={styles.loadSummaryRow}>
                  <Text style={styles.totalLoadText}>{Math.round(data.currentWeekTotal)} pts</Text>
                  <View style={[styles.percentageBadge, { backgroundColor: data.percentageChange >= 0 ? '#1a3a1a' : '#3a2a1a' }]}>
                    <Ionicons name={data.percentageChange >= 0 ? "trending-up" : "trending-down"} size={14} color={data.percentageChange >= 0 ? "#2e7d32" : "#e65100"} />
                    <Text style={[styles.percentageText, { color: data.percentageChange >= 0 ? "#2e7d32" : "#e65100" }]}>
                      {data.percentageChange >= 0 ? '+' : ''}{Math.round(data.percentageChange)}%
                    </Text>
                  </View>
                </View>
              </View>
              {selectedDay && (
                <View style={styles.selectedDayDisplay}>
                  <Text style={styles.selectedDayLabel}>
                    {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                  </Text>
                  <Text style={styles.selectedDayValue}>{Math.round(selectedDay.load)} pts</Text>
                </View>
              )}
            </View>

            <View style={styles.chartRow}>
              {data.weeklyLoadData.map((day: any, idx: any) => (
                <TouchableOpacity key={idx} style={styles.barColumn} onPress={() => setSelectedDay(selectedDay?.date === day.date ? null : day)}>
                  <View style={[styles.bar, { 
                    height: Math.max(5, Math.min(day.load / 10, 80)), 
                    backgroundColor: day.load > 800 ? '#F44336' : '#5856D6', 
                    opacity: selectedDay ? (selectedDay.date === day.date ? 1 : 0.4) : 1 
                  }]} />
                  <Text style={styles.barDate}>{parseInt(day.date.split('-')[2])}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </View>

        {/* Metriken heute */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Metriken heute</Text>
          <View style={styles.statsGrid}>
            <StatCard icon="flame-outline" label="Tages-Last" value={data.todayLoad} unit="pts" color="#FF9800" />
            <StatCard icon="heart-outline" label="HRV (RMSSD)" value={data.fitbitData?.hrv} unit="ms" color="#E91E63" />
            <StatCard icon="moon-outline" label="Schlaf" value={data.fitbitData?.sleepHours} unit="h" color="#9C27B0" />
            <StatCard icon="pulse-outline" label="Ruhepuls" value={data.fitbitData?.restingHr} unit="bpm" color="#F44336" />
          </View>
        </View>
      </Pressable>
    </ScrollView>
  );
}

// Hier kommen deine Styles aus der alten Dashboard-Datei rein...
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f0f0f' },
    scrollContent: { padding: 20, paddingTop: 20, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    dateText: { fontSize: 16, color: '#888888', marginBottom: 5, textAlign: 'center' },
    statusRow: { alignItems: 'center', marginBottom: 15 },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, borderWidth: 1 },
    badgeSuccess: { backgroundColor: '#1a3a1a', borderColor: '#4CAF50' },
    badgeWait: { backgroundColor: '#3a2a1a', borderColor: '#FF9800' },
    badgeText: { fontSize: 12, fontWeight: '600' },
    mainContent: { alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
    fitbitWorkoutSection: { marginTop: 8, marginBottom: 16, gap: 10 },
    fitbitSectionTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff', marginBottom: 2 },
    fitbitEmptyCard: { backgroundColor: '#2a2a2a', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    fitbitEmptyText: { color: '#888888', fontSize: 13, fontWeight: '500' },
    fitbitWorkoutCard: { backgroundColor: '#2a2a2a', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#3a3a3a', gap: 10 },
    fitbitWorkoutInfo: { gap: 4 },
    fitbitWorkoutName: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
    fitbitWorkoutMeta: { color: '#aaaaaa', fontSize: 12, fontWeight: '500' },
    fitbitWorkoutActions: { flexDirection: 'row', gap: 8 },
    ignoreButton: { flex: 1, backgroundColor: '#3a2a1a', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FF9800' },
    ignoreButtonText: { color: '#FFB74D', fontSize: 13, fontWeight: '700' },
    linkButton: { flex: 1, backgroundColor: '#1f2a4a', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#5C9CFF' },
    linkButtonText: { color: '#9ec5ff', fontSize: 13, fontWeight: '700' },
    actionContainer: { marginTop: 10, marginBottom: 25, gap: 12 },
    logButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    trainingButton: { backgroundColor: '#5856D6' },
    logButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    completedBox: { padding: 16, borderRadius: 15, backgroundColor: '#1a3a1a', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    completedText: { color: '#4CAF50', fontSize: 16, fontWeight: '600' },
    trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    trendCard: { backgroundColor: '#2a2a2a', padding: 15, borderRadius: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
    trendTitle: { fontSize: 14, fontWeight: '700', color: '#888888', marginBottom: 15 },
    chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
    barColumn: { alignItems: 'center', width: '12%' },
    bar: { width: '80%', borderRadius: 4 },
    barDate: { fontSize: 10, color: '#666666', marginTop: 5 },
    loadSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    totalLoadText: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
    percentageBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
    percentageText: { fontSize: 12, fontWeight: '700' },
    selectedDayDisplay: { alignItems: 'flex-end' },
    selectedDayLabel: { fontSize: 12, color: '#888888', marginBottom: 4 },
    selectedDayValue: { fontSize: 18, fontWeight: '800', color: '#5856D6' },
    detailsSection: { marginTop: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 15 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
    statCard: { backgroundColor: '#2a2a2a', width: '48%', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5 },
    iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    statLabel: { fontSize: 12, color: '#888888' },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
    statUnit: { fontSize: 12, fontWeight: 'normal', color: '#888888' }
});