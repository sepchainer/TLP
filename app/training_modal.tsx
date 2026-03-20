import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import ColorGradientSlider from '../components/ColorGradientSlider';
import { WorkoutType } from '../lib/workoutType';
import { useWorkoutTypeContext } from '../lib/WorkoutTypeContext';

function getTodayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export default function TrainingModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ duration?: string; prefillNotes?: string; fitbitStartTime?: string; fitbitLogId?: string; workoutId?: string; date?: string }>();
  const queryClient = useQueryClient();
  const { selectedWorkoutTypes, setSelectedWorkoutTypes } = useWorkoutTypeContext();
  const targetDate = typeof params.date === 'string' ? params.date : getTodayIso();
  const workoutId = typeof params.workoutId === 'string' ? params.workoutId : null;
  const isEditing = !!workoutId;
  
  const [duration, setDuration] = useState('60');
  const [muscularEffort, setMuscularEffort] = useState(5);
  const [respirationEffort, setRespirationEffort] = useState(5);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [existingDate, setExistingDate] = useState(targetDate);

  useEffect(() => {
    let isMounted = true;

    async function hydrateForEdit() {
      if (!isEditing || !workoutId) {
        return;
      }

      setIsInitializing(true);

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) throw new Error('Nicht authentifiziert');

        const { data: workout, error } = await supabase
          .from('workout_logs')
          .select('id, date, workout_types, duration_minutes, muscular_effort, respiration_effort, calculated_load, notes')
          .eq('user_id', authData.user.id)
          .eq('id', workoutId)
          .maybeSingle();

        if (error) throw error;
        if (!workout) throw new Error('Training nicht gefunden');

        if (isMounted) {
          setExistingDate(workout.date || targetDate);
          setDuration(String(workout.duration_minutes || 0));
          setMuscularEffort(workout.muscular_effort ?? 5);
          setRespirationEffort(workout.respiration_effort ?? 5);
          setNotes(workout.notes ?? '');
          setSelectedWorkoutTypes(Array.isArray(workout.workout_types) ? workout.workout_types : []);
        }
      } catch (error: any) {
        if (isMounted) {
          Alert.alert('Fehler', error.message || 'Training konnte nicht geladen werden.');
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    void hydrateForEdit();

    if (typeof params.duration === 'string') {
      const parsed = Math.max(1, Math.round(Number(params.duration) || 0));
      if (parsed > 0) {
        setDuration(String(parsed));
      }
    }

    const startTime = typeof params.fitbitStartTime === 'string' ? params.fitbitStartTime : null;
    const startText = startTime
      ? new Date(startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : null;
    const noteFromParams = typeof params.prefillNotes === 'string' ? params.prefillNotes : '';

    if (noteFromParams || startText) {
      const withTime = startText && !noteFromParams.includes('Start:')
        ? `${noteFromParams}${noteFromParams ? ' | ' : ''}Start: ${startText}`
        : noteFromParams;

      if (withTime) {
        setNotes(withTime);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [isEditing, params.duration, params.fitbitStartTime, params.prefillNotes, setSelectedWorkoutTypes, targetDate, workoutId]);

  const handleMuscularChange = useCallback((v: number) => setMuscularEffort(v), []);
  const handleRespirationChange = useCallback((v: number) => setRespirationEffort(v), []);

  const getWorkoutTypeLabel = (type: WorkoutType): string => {
    const labels: { [key in WorkoutType]: string } = {
      [WorkoutType.KRAFTTRAINING]: 'Krafttraining (Strength)',
      [WorkoutType.CARDIO]: 'Cardio',
      [WorkoutType.PLYOMETRICS]: 'Plyometrics',
      [WorkoutType.SPIEL_SIMULATION]: 'Spiel Simulation',
      [WorkoutType.TECHNISCHE_DRILLS]: 'Technische Drills',
      [WorkoutType.WETTKAMPF]: 'Wettkampf (Competition)',
      [WorkoutType.AUFWAERMEN]: 'Aufwärmen (Warm-up)',
      [WorkoutType.MOBILITY]: 'Mobility',
      [WorkoutType.DEHNEN]: 'Dehnen (Stretching)',
      [WorkoutType.REGENERATION]: 'Regeneration',
      [WorkoutType.PREHAB]: 'Prehab'
    };
    return labels[type] || 'Unknown';
  };

  const durationInt = parseInt(duration) || 0;
  const previewLoad = Math.round(((muscularEffort + respirationEffort) / 2) * durationInt);

  const linkedFitbitLogId = typeof params.fitbitLogId === 'string' ? params.fitbitLogId.trim() : '';

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

      // 3. Training in Supabase speichern
      const fitbitMarker = linkedFitbitLogId ? `[fitbit_log_id:${linkedFitbitLogId}]` : '';
      const normalizedNotes = notes.trim();
      const finalNotes = fitbitMarker && !normalizedNotes.includes(fitbitMarker)
        ? `${normalizedNotes}${normalizedNotes ? '\n' : ''}${fitbitMarker}`
        : normalizedNotes;

      const payload = {
        workout_types: selectedWorkoutTypes,
        duration_minutes: durationInt,
        muscular_effort: muscularEffort,
        respiration_effort: respirationEffort,
        calculated_load: previewLoad,
        notes: finalNotes,
        date: isEditing ? existingDate : targetDate,
      };

      const { error } = isEditing
        ? await supabase.from('workout_logs').update(payload).eq('user_id', user.id).eq('id', workoutId)
        : await supabase.from('workout_logs').insert({
            user_id: user.id,
            ...payload,
          });

      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboardData'] }),
        queryClient.invalidateQueries({ queryKey: ['wellnessHistory'] }),
      ]);

      router.back();
    } catch (error: any) {
      Alert.alert("Fehler", error.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5856D6" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" style={{ backgroundColor: '#1a1a1a' }}>
      <Text style={styles.title}>{isEditing ? 'Training bearbeiten' : 'Training loggen'}</Text>
      <Text style={styles.dateText}>{isEditing ? existingDate : targetDate}</Text>

      <View style={styles.loadPreviewCard}>
        <Text style={styles.previewLabel}>Voraussichtliche Last</Text>
        <Text style={styles.previewValue}>{previewLoad} <Text style={styles.previewUnit}>pts</Text></Text>
      </View>

      <Text style={styles.subTitle}>Was hast du trainiert? (optional)</Text>
      <TouchableOpacity
        style={styles.selectTypesButton}
        onPress={() => router.push('/workout_type_selector')}
      >
        <Ionicons name="checkmark-circle" size={20} color="#5856D6" style={styles.selectTypesIcon} />
        <View style={styles.selectTypesContent}>
          <Text style={styles.selectTypesLabel}>Trainingstypen wählen</Text>
          <Text style={styles.selectTypesValue}>
            {selectedWorkoutTypes.length > 0 
              ? `${selectedWorkoutTypes.length} ausgewählt` 
              : 'Keine Auswahl'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#888888" />
      </TouchableOpacity>

      {selectedWorkoutTypes.length > 0 && (
        <View style={styles.selectedTypesContainer}>
          {selectedWorkoutTypes.map((type) => (
            <View key={type} style={styles.selectedTypeTag}>
              <Text style={styles.selectedTypeTagText}>{getWorkoutTypeLabel(type)}</Text>
            </View>
          ))}
        </View>
      )}

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

      <ColorGradientSlider
        label="Muskuläre Belastung (RPE)"
        initialValue={muscularEffort}
        onValueChange={handleMuscularChange}
        isReversed={true}
      />
      
      <ColorGradientSlider
        label="Atmung / Puls (RPE)"
        initialValue={respirationEffort}
        onValueChange={handleRespirationChange}
        isReversed={true}
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
          <Text style={styles.saveButtonText}>{isEditing ? 'Änderungen speichern' : 'Training speichern'}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  container: { padding: 25, backgroundColor: '#1a1a1a', paddingBottom: 40, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', color: '#ffffff' },
  dateText: { textAlign: 'center', color: '#9a9a9a', marginBottom: 12, fontSize: 13 },
  
  loadPreviewCard: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#3a3a3a'
  },
  previewLabel: { fontSize: 12, color: '#888888', textTransform: 'uppercase', letterSpacing: 1 },
  previewValue: { fontSize: 32, fontWeight: '800', color: '#5856D6' },
  previewUnit: { fontSize: 16, fontWeight: '600', color: '#888888' },

  subTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#ffffff' },
  typeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  typeButton: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 25, borderWidth: 1, borderColor: '#3a3a3a', backgroundColor: '#2a2a2a' },
  typeButtonActive: { backgroundColor: '#5856D6', borderColor: '#5856D6' },
  typeButtonText: { color: '#888888', fontWeight: '500' },
  typeButtonTextActive: { color: 'white', fontWeight: '700' },

  selectTypesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 12
  },
  selectTypesIcon: {
    marginRight: 4
  },
  selectTypesContent: {
    flex: 1
  },
  selectTypesLabel: {
    fontSize: 14,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  selectTypesValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff'
  },
  selectedTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15
  },
  selectedTypeTag: {
    backgroundColor: '#5856D6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  selectedTypeTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff'
  },

  inputGroup: { marginBottom: 15 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  valueText: { fontWeight: 'bold', fontSize: 16 },
  textInput: { backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#3a3a3a', borderRadius: 12, padding: 14, fontSize: 16, color: '#ffffff', marginTop: 12 },
  textArea: { height: 80, textAlignVertical: 'top' },
  
  saveButton: { backgroundColor: '#5856D6', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10, shadowColor: '#5856D6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});