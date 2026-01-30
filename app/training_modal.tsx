import React, { useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// 1. Isolierte Slider-Komponente gegen das Ruckeln
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

export default function TrainingModal() {
  const router = useRouter();
  
  // States
  const [workoutType, setWorkoutType] = useState('Kraft');
  const [duration, setDuration] = useState('60');
  const [muscularEffort, setMuscularEffort] = useState(5);
  const [respirationEffort, setRespirationEffort] = useState(5);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Stabile Update-Funktionen
  const handleMuscularChange = useCallback((v: number) => setMuscularEffort(v), []);
  const handleRespirationChange = useCallback((v: number) => setRespirationEffort(v), []);

  // Live-Berechnung der Last für die UI-Vorschau
  const durationInt = parseInt(duration) || 0;
  const previewLoad = Math.round(((muscularEffort + respirationEffort) / 2) * durationInt);

  async function saveWorkout() {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht authentifiziert");

      if (durationInt <= 0) {
        Alert.alert("Fehler", "Bitte gib eine gültige Dauer ein.");
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from('workout_logs').insert({
        user_id: user.id,
        workout_type: workoutType,
        duration_minutes: durationInt,
        muscular_effort: muscularEffort,
        respiration_effort: respirationEffort,
        calculated_load: previewLoad,
        notes: notes,
        date: new Date().toISOString().split('T')[0]
      });

      if (error) throw error;
      router.back();
    } catch (error: any) {
      Alert.alert("Fehler", error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Training loggen</Text>

      {/* Belastungs-Vorschau Badge */}
      <View style={styles.loadPreviewCard}>
        <Text style={styles.previewLabel}>Voraussichtliche Last</Text>
        <Text style={styles.previewValue}>{previewLoad} <Text style={styles.previewUnit}>pts</Text></Text>
      </View>

      <Text style={styles.subTitle}>Was hast du trainiert?</Text>
      <View style={styles.typeContainer}>
        {['Kraft', 'Cardio', 'Mobility', 'Wettkampf'].map((type) => (
          <TouchableOpacity 
            key={type} 
            style={[styles.typeButton, workoutType === type && styles.typeButtonActive]}
            onPress={() => setWorkoutType(type)}
          >
            <Text style={[styles.typeButtonText, workoutType === type && styles.typeButtonTextActive]}>{type}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Dauer (Minuten)</Text>
        <TextInput 
          style={styles.textInput}
          keyboardType="numeric"
          value={duration}
          onChangeText={setDuration}
          placeholder="z.B. 60"
        />
      </View>

      <SliderGroup 
        label="Muskuläre Belastung (RPE)" 
        initialValue={muscularEffort} 
        onValueChange={handleMuscularChange} 
        color="#FF5722" 
      />
      
      <SliderGroup 
        label="Atmung / Puls (RPE)" 
        initialValue={respirationEffort} 
        onValueChange={handleRespirationChange} 
        color="#03A9F4" 
      />

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Notizen (optional)</Text>
        <TextInput 
          style={[styles.textInput, styles.textArea]}
          multiline 
          numberOfLines={3}
          value={notes} 
          onChangeText={setNotes}
          placeholder="Wie lief es?"
        />
      </View>

      <TouchableOpacity 
        style={[styles.saveButton, isSaving && { opacity: 0.7 }]} 
        onPress={saveWorkout}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.saveButtonText}>Training speichern</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 25, backgroundColor: 'white', paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  
  loadPreviewCard: {
    backgroundColor: '#f1f3f9',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  previewLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  previewValue: { fontSize: 32, fontWeight: '800', color: '#5856D6' },
  previewUnit: { fontSize: 16, fontWeight: '600', color: '#94a3b8' },

  subTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
  typeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  typeButton: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 25, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  typeButtonActive: { backgroundColor: '#5856D6', borderColor: '#5856D6' },
  typeButtonText: { color: '#64748b', fontWeight: '500' },
  typeButtonTextActive: { color: 'white', fontWeight: '700' },

  inputGroup: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 16, fontWeight: '600', color: '#333' },
  valueText: { fontWeight: 'bold', fontSize: 16 },
  slider: { width: '100%', height: 40 },
  
  textInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 16, color: '#1e293b' },
  textArea: { height: 80, textAlignVertical: 'top' },
  
  saveButton: { backgroundColor: '#5856D6', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10, shadowColor: '#5856D6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});