import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';
import { calculateReadiness } from '../lib/calculations';
import { fetchFitbitWellnessData } from '../lib/fitbit_sync';
import { Ionicons } from '@expo/vector-icons';

// 1. Isolierte Slider-Komponente (Memoized gegen Ruckeln)
const SliderGroup = memo(({ label, initialValue, onValueChange, color }: any) => {
  const [displayValue, setDisplayValue] = useState(initialValue);

  return (
    <View style={styles.inputGroup}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.valueText, { color }]}>{Math.round(displayValue)}/10</Text>
      </View>
      <Slider 
        style={styles.slider}
        minimumValue={1} 
        maximumValue={10}
        step={1}
        value={initialValue} 
        onValueChange={(v) => setDisplayValue(v)}
        onSlidingComplete={(v) => onValueChange(v)}
        minimumTrackTintColor={color}
        thumbTintColor={color}
        tapToSeek={true}
      />
    </View>
  );
});

export default function WellnessModal() {
  const router = useRouter();
  
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
          if (data.sleepHours) setSleepQuality(Math.min(Math.round(data.sleepHours), 10));
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
      const subjectiveData = {
          mood, recovery, health, physical, sleep: sleepQuality, stress, isSick
      };

      const score = calculateReadiness(subjectiveData, fitbitData);

      const { error: logError } = await supabase.from('wellness_logs').upsert({
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

      if (logError) throw logError;
      router.back();
    } catch (error: any) {
      Alert.alert("Fehler", error.message);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
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
      
      <SliderGroup label="Stimmung" initialValue={mood} onValueChange={handleMood} color="#FFD700" />
      <SliderGroup label="Erholung" initialValue={recovery} onValueChange={handleRecovery} color="#4CAF50" />
      <SliderGroup label="Körperliches Gefühl" initialValue={physical} onValueChange={handlePhysical} color="#FF5722" />
      <SliderGroup label="Gesundheit" initialValue={health} onValueChange={handleHealth} color="#2196F3" />
      <SliderGroup label="Stresslevel" initialValue={stress} onValueChange={handleStress} color="#F44336" />
      <SliderGroup label="Schlafqualität" initialValue={sleepQuality} onValueChange={handleSleep} color="#9C27B0" />

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
  container: { padding: 25, backgroundColor: 'white', paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  fitbitInfoBox: { 
    height: 55, // Feste Höhe verhindert UI-Sprünge beim Laden
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, 
    marginBottom: 25, gap: 10, borderWidth: 1 
  },
  fitbitSuccess: { backgroundColor: '#e8f5e9', borderColor: '#c8e6c9' },
  fitbitMissing: { backgroundColor: '#fff3e0', borderColor: '#ffe0b2' },
  fitbitText: { fontSize: 12, fontWeight: '500', flex: 1, color: '#444' },
  inputGroup: { marginBottom: 15 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label: { fontSize: 16, fontWeight: '600', color: '#333' },
  valueText: { fontWeight: 'bold', fontSize: 16 },
  slider: { width: '100%', height: 40 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 20, gap: 10 },
  toggleButton: { flex: 1, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#eee', alignItems: 'center', backgroundColor: '#f8f9fa' },
  toggleText: { fontWeight: '600' },
  sickActive: { backgroundColor: '#ffebee', borderColor: '#ef5350' },
  injuredActive: { backgroundColor: '#fff3e0', borderColor: '#ff9800' },
  saveButton: { backgroundColor: '#007AFF', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});