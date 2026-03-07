import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';
import { calculateReadiness } from '../lib/calculations';
import { fetchFitbitWellnessData } from '../lib/fitbit_sync';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardData } from '../hooks/useDashboardData';
import ColorGradientSlider from '../components/ColorGradientSlider';

export default function WellnessModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: dashData } = useDashboardData();
  
  // States
  const [mood, setMood] = useState(5);
  const [recovery, setRecovery] = useState(5);
  const [health, setHealth] = useState(5);
  const [physical, setPhysical] = useState(5);
  const [sleepQuality, setSleepQuality] = useState(5);
  const [stress, setStress] = useState(5);
  const [isSick, setIsSick] = useState(false);
  const [isInjured, setIsInjured] = useState(false);

  const [fitbitData, setFitbitData] = useState<any>(null);
  const [isLoadingFitbit, setIsLoadingFitbit] = useState(true);

  // Fitbit Daten laden
  useEffect(() => {
    async function loadFitbit() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const data = await fetchFitbitWellnessData(user.id);
        if (data) {
          setFitbitData(data);
          // Note: sleepQuality is subjective (user input), not based on sleep duration
          // sleepHours is stored in fitbitData for the objective calculation
        }
      }
      setIsLoadingFitbit(false);
    }
    loadFitbit();
  }, []);

  // Stabile Update-Funktionen (verhindern Re-renders der SliderGroups)
  const handleMood = useCallback((v: number) => setMood(v), []);
  const handleRecovery = useCallback((v: number) => setRecovery(v), []);
  const handleHealth = useCallback((v: number) => setHealth(v), []);
  const handlePhysical = useCallback((v: number) => setPhysical(v), []);
  const handleSleep = useCallback((v: number) => setSleepQuality(v), []);
  const handleStress = useCallback((v: number) => setStress(v), []);

async function saveWellness() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      
      // 1. Subjektive Daten
      const subjectiveData = {
        mood, recovery, health, physical, sleep: sleepQuality, stress, isSick
      };

      // 2. Objektive Daten (Baselines kommen nun sicher aus dashData)
      const objectiveData = {
        hrv: fitbitData?.hrv || null,
        sleepHours: fitbitData?.sleepHours || null,
        restingHr: fitbitData?.restingHr || null,
        baselineHrv: dashData?.avgHrv || 60, 
        baselineRhr: dashData?.avgRhr || 60
      };

      // 3. Workload-Variablen für die Berechnung
      const currentLoad = dashData?.todayLoad || 0;
      const past6dLoad = (dashData?.currentWeekTotal || 0) - currentLoad;
      const past13dLoad = (dashData?.total14dLoad || 0) - currentLoad;

      // Readiness berechnen
      const score = calculateReadiness(
        subjectiveData,
        objectiveData,
        currentLoad,
        past6dLoad,
        past13dLoad
      );

      // In Datenbank speichern
      await supabase.from('wellness_logs').upsert({
          user_id: user.id,
          date: today,
          mood, recovery, health_status: health, physical, sleep: sleepQuality, stress,
          is_sick: isSick, is_injured: isInjured,
          hrv: fitbitData?.hrv || null,
          sleep_hours: fitbitData?.sleepHours || null,
          resting_hr: fitbitData?.restingHr || null
      });

      await supabase.from('readiness_scores').upsert({
          user_id: user.id,
          score_value: score,
          date: today
      });

      // Dashboard Cache löschen, damit es sofort neu lädt
      await queryClient.invalidateQueries({ queryKey: ['dashboardData'] });

      router.back();
    } catch (error: any) {
      Alert.alert("Fehler", error.message);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false} style={{ backgroundColor: '#1a1a1a' }}>
      <Text style={styles.title}>Daily Check-In</Text>

      <View style={[styles.fitbitInfoBox, fitbitData ? styles.fitbitSuccess : styles.fitbitMissing]}>
        {isLoadingFitbit ? (
          <ActivityIndicator size="small" color="#666" />
        ) : (
          <>
            <Ionicons 
              name={fitbitData ? "watch-outline" : "warning-outline"} 
              size={20} 
              color={fitbitData ? "#2e7d32" : "#a66a00"} 
            />
            <Text style={styles.fitbitText}>
              {fitbitData 
                ? `Fitbit geladen: HRV ${fitbitData.hrv}ms | Schlaf ${fitbitData.sleepHours}h`
                : "Keine Fitbit-Daten für heute gefunden."}
            </Text>
          </>
        )}
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
          onPress={() => setIsSick(!isSick)}
        >
          <Text style={styles.toggleText}>{isSick ? "Krank 🤒" : "Gesund 👍"}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleButton, isInjured && styles.injuredActive]}
          onPress={() => setIsInjured(!isInjured)}
        >
          <Text style={styles.toggleText}>{isInjured ? "Verletzt 🤕" : "Fit 💪"}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={saveWellness}>
        <Text style={styles.saveButtonText}>Check-In abschließen</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 25, backgroundColor: '#1a1a1a', paddingBottom: 40, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', color: '#ffffff' },
  fitbitInfoBox: { 
    height: 55,
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, 
    marginBottom: 15, gap: 10, borderWidth: 1 
  },
  fitbitSuccess: { backgroundColor: '#1a3a1a', borderColor: '#4CAF50' },
  fitbitMissing: { backgroundColor: '#3a2a1a', borderColor: '#FF9800' },
  fitbitText: { fontSize: 12, fontWeight: '500', flex: 1, color: '#cccccc' },
  inputGroup: { marginBottom: 15 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  valueText: { fontWeight: 'bold', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12, gap: 10 },
  toggleButton: { flex: 1, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333333', alignItems: 'center', backgroundColor: '#2a2a2a' },
  toggleText: { fontWeight: '600', color: '#ffffff' },
  sickActive: { backgroundColor: '#3a1a1a', borderColor: '#F44336' },
  injuredActive: { backgroundColor: '#3a2a1a', borderColor: '#FF9800' },
  saveButton: { backgroundColor: '#007AFF', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});