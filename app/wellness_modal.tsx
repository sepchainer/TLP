import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchFitbitWellnessData } from '../lib/fitbit_sync';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import ColorGradientSlider from '../components/ColorGradientSlider';
import { calculateReadinessForDate, getHistoryContextStart, ReadinessWellnessLog } from '../lib/readinessTimeline';

interface ObjectiveSnapshot {
  hrv: number | null;
  sleepHours: number | null;
  restingHr: number | null;
}

function getTodayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export default function WellnessModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ date?: string }>();
  const targetDate = typeof params.date === 'string' ? params.date : getTodayIso();
  const isTodayTarget = targetDate === getTodayIso();
  const isEditing = typeof params.date === 'string';

  const [mood, setMood] = useState(5);
  const [recovery, setRecovery] = useState(5);
  const [health, setHealth] = useState(5);
  const [physical, setPhysical] = useState(5);
  const [sleepQuality, setSleepQuality] = useState(5);
  const [stress, setStress] = useState(5);
  const [isSick, setIsSick] = useState(false);
  const [isInjured, setIsInjured] = useState(false);
  const [objectiveSnapshot, setObjectiveSnapshot] = useState<ObjectiveSnapshot>({
    hrv: null,
    sleepHours: null,
    restingHr: null,
  });
  const [fitbitData, setFitbitData] = useState<ObjectiveSnapshot | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialValues() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) throw new Error('Nicht eingeloggt');

        const { data: existingLog, error: existingError } = await supabase
          .from('wellness_logs')
          .select('date, mood, recovery, health_status, physical, sleep, stress, is_sick, is_injured, hrv, sleep_hours, resting_hr')
          .eq('user_id', authData.user.id)
          .eq('date', targetDate)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existingLog && isMounted) {
          setMood(existingLog.mood ?? 5);
          setRecovery(existingLog.recovery ?? 5);
          setHealth(existingLog.health_status ?? 5);
          setPhysical(existingLog.physical ?? 5);
          setSleepQuality(existingLog.sleep ?? 5);
          setStress(existingLog.stress ?? 5);
          setIsSick(!!existingLog.is_sick);
          setIsInjured(!!existingLog.is_injured);
          setObjectiveSnapshot({
            hrv: existingLog.hrv ?? null,
            sleepHours: existingLog.sleep_hours ?? null,
            restingHr: existingLog.resting_hr ?? null,
          });
        }

        if (isTodayTarget) {
          const realtimeFitbit = await fetchFitbitWellnessData(authData.user.id);
          if (isMounted && realtimeFitbit) {
            setFitbitData({
              hrv: realtimeFitbit.hrv ?? null,
              sleepHours: realtimeFitbit.sleepHours ?? null,
              restingHr: realtimeFitbit.restingHr ?? null,
            });
          }
        }
      } catch (error: any) {
        if (isMounted) {
          Alert.alert('Fehler', error.message || 'Initiale Daten konnten nicht geladen werden.');
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    void loadInitialValues();

    return () => {
      isMounted = false;
    };
  }, [isTodayTarget, targetDate]);

  const effectiveObjectiveData = useMemo<ObjectiveSnapshot>(() => {
    if (!isTodayTarget) {
      return objectiveSnapshot;
    }

    return {
      hrv: fitbitData?.hrv ?? objectiveSnapshot.hrv,
      sleepHours: fitbitData?.sleepHours ?? objectiveSnapshot.sleepHours,
      restingHr: fitbitData?.restingHr ?? objectiveSnapshot.restingHr,
    };
  }, [fitbitData, isTodayTarget, objectiveSnapshot]);

  const handleMood = useCallback((value: number) => setMood(value), []);
  const handleRecovery = useCallback((value: number) => setRecovery(value), []);
  const handleHealth = useCallback((value: number) => setHealth(value), []);
  const handlePhysical = useCallback((value: number) => setPhysical(value), []);
  const handleSleep = useCallback((value: number) => setSleepQuality(value), []);
  const handleStress = useCallback((value: number) => setStress(value), []);

  async function saveWellness() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Nicht eingeloggt');

      const nextWellnessLog: ReadinessWellnessLog = {
        date: targetDate,
        mood,
        recovery,
        health_status: health,
        physical,
        sleep: sleepQuality,
        stress,
        is_sick: isSick,
        is_injured: isInjured,
        hrv: effectiveObjectiveData.hrv,
        sleep_hours: effectiveObjectiveData.sleepHours,
        resting_hr: effectiveObjectiveData.restingHr,
      };

      const contextStart = getHistoryContextStart(targetDate);
      const [wellnessContext, workoutContext] = await Promise.all([
        supabase
          .from('wellness_logs')
          .select('date, mood, recovery, health_status, physical, sleep, stress, is_sick, is_injured, hrv, sleep_hours, resting_hr')
          .eq('user_id', authData.user.id)
          .gte('date', contextStart)
          .lte('date', targetDate),
        supabase
          .from('workout_logs')
          .select('id, date, calculated_load')
          .eq('user_id', authData.user.id)
          .gte('date', contextStart)
          .lte('date', targetDate),
      ]);

      if (wellnessContext.error) throw wellnessContext.error;
      if (workoutContext.error) throw workoutContext.error;

      const mergedWellnessLogs = [
        ...(wellnessContext.data || []).filter((entry) => entry.date !== targetDate),
        nextWellnessLog,
      ];

      const score = calculateReadinessForDate(targetDate, mergedWellnessLogs, workoutContext.data || []);

      const { error: upsertError } = await supabase.from('wellness_logs').upsert({
        user_id: authData.user.id,
        date: targetDate,
        mood,
        recovery,
        health_status: health,
        physical,
        sleep: sleepQuality,
        stress,
        is_sick: isSick,
        is_injured: isInjured,
        hrv: effectiveObjectiveData.hrv,
        sleep_hours: effectiveObjectiveData.sleepHours,
        resting_hr: effectiveObjectiveData.restingHr,
      });

      if (upsertError) throw upsertError;

      const { error: scoreError } = await supabase.from('readiness_scores').upsert({
        user_id: authData.user.id,
        score_value: score ?? 0,
        date: targetDate,
      });

      if (scoreError) throw scoreError;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wellnessHistory'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboardData'] }),
      ]);

      router.back();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Wellness-Log konnte nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false} style={styles.scrollView}>
      <Text style={styles.title}>{isEditing ? 'Wellness bearbeiten' : 'Daily Check-In'}</Text>
      <Text style={styles.dateText}>{targetDate}</Text>

      <View style={[styles.fitbitInfoBox, effectiveObjectiveData.hrv ? styles.fitbitSuccess : styles.fitbitMissing]}>
        <Ionicons
          name={isTodayTarget ? (effectiveObjectiveData.hrv ? 'watch-outline' : 'warning-outline') : 'calendar-outline'}
          size={20}
          color={effectiveObjectiveData.hrv ? '#2e7d32' : '#a66a00'}
        />
        <Text style={styles.fitbitText}>
          {isTodayTarget
            ? effectiveObjectiveData.hrv
              ? `Objektive Werte: HRV ${effectiveObjectiveData.hrv}ms | Schlaf ${effectiveObjectiveData.sleepHours ?? '--'}h | RHR ${effectiveObjectiveData.restingHr ?? '--'}`
              : 'Keine aktuellen Fitbit-Daten gefunden. Es werden gespeicherte Werte verwendet.'
            : `Historischer Log: HRV ${effectiveObjectiveData.hrv ?? '--'}ms | Schlaf ${effectiveObjectiveData.sleepHours ?? '--'}h | RHR ${effectiveObjectiveData.restingHr ?? '--'}`}
        </Text>
      </View>

      <ColorGradientSlider label="Stimmung" initialValue={mood} onValueChange={handleMood} />
      <ColorGradientSlider label="Erholung" initialValue={recovery} onValueChange={handleRecovery} />
      <ColorGradientSlider label="Körperliches Gefühl" initialValue={physical} onValueChange={handlePhysical} />
      <ColorGradientSlider label="Gesundheit" initialValue={health} onValueChange={handleHealth} />
      <ColorGradientSlider label="Stresslevel" initialValue={stress} onValueChange={handleStress} isReversed={true} />
      <ColorGradientSlider label="Schlafqualität" initialValue={sleepQuality} onValueChange={handleSleep} />

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.toggleButton, isSick && styles.sickActive]}
          onPress={() => setIsSick((current) => !current)}
        >
          <Text style={styles.toggleText}>{isSick ? 'Krank' : 'Gesund'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, isInjured && styles.injuredActive]}
          onPress={() => setIsInjured((current) => !current)}
        >
          <Text style={styles.toggleText}>{isInjured ? 'Verletzt' : 'Fit'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.saveButton, isSaving && styles.disabledButton]} onPress={saveWellness} disabled={isSaving}>
        {isSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveButtonText}>{isEditing ? 'Änderungen speichern' : 'Check-In abschließen'}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { backgroundColor: '#1a1a1a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  container: { padding: 25, backgroundColor: '#1a1a1a', paddingBottom: 40, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 6, textAlign: 'center', color: '#ffffff' },
  dateText: { textAlign: 'center', color: '#9a9a9a', marginBottom: 12, fontSize: 13 },
  fitbitInfoBox: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    gap: 10,
    borderWidth: 1,
  },
  fitbitSuccess: { backgroundColor: '#1a3a1a', borderColor: '#4CAF50' },
  fitbitMissing: { backgroundColor: '#3a2a1a', borderColor: '#FF9800' },
  fitbitText: { fontSize: 12, fontWeight: '500', flex: 1, color: '#cccccc', lineHeight: 17 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12, gap: 10 },
  toggleButton: { flex: 1, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333333', alignItems: 'center', backgroundColor: '#2a2a2a' },
  toggleText: { fontWeight: '600', color: '#ffffff' },
  sickActive: { backgroundColor: '#3a1a1a', borderColor: '#F44336' },
  injuredActive: { backgroundColor: '#3a2a1a', borderColor: '#FF9800' },
  saveButton: { backgroundColor: '#007AFF', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  disabledButton: { opacity: 0.7 },
  saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});