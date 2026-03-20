import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // WICHTIG: Neuer Import
import { WorkoutType } from '../lib/workoutType';
import { useWorkoutTypeContext } from '../lib/WorkoutTypeContext';

interface WorkoutTypeCategory {
  name: string;
  types: Array<{
    key: WorkoutType;
    label: string;
  }>;
}

export default function WorkoutTypeSelector() {
  const router = useRouter();
  const { setSelectedWorkoutTypes } = useWorkoutTypeContext();
  const [localSelectedTypes, setLocalSelectedTypes] = useState<WorkoutType[]>([]);
  
  // Holt die dynamischen Ränder des Geräts (Notch oben, Home-Balken unten)
  const insets = useSafeAreaInsets();

  const workoutCategories: WorkoutTypeCategory[] = [
    {
      name: 'Warm-up & Mobility',
      types: [
        { key: WorkoutType.AUFWAERMEN, label: 'Aufwärmen (Warm-up)' },
        { key: WorkoutType.MOBILITY, label: 'Mobility' },
        { key: WorkoutType.DEHNEN, label: 'Dehnen (Stretching)' },
      ]
    },
    {
      name: 'Training',
      types: [
        { key: WorkoutType.KRAFTTRAINING, label: 'Krafttraining (Strength)' },
        { key: WorkoutType.CARDIO, label: 'Cardio' },
        { key: WorkoutType.PLYOMETRICS, label: 'Plyometrics' },
        { key: WorkoutType.TECHNISCHE_DRILLS, label: 'Technische Drills' },
      ]
    },
    {
      name: 'Competition & Recovery',
      types: [
        { key: WorkoutType.WETTKAMPF, label: 'Wettkampf (Competition)' },
        { key: WorkoutType.SPIEL_SIMULATION, label: 'Spiel Simulation' },
        { key: WorkoutType.REGENERATION, label: 'Regeneration' },
        { key: WorkoutType.PREHAB, label: 'Prehab' },
      ]
    }
  ];

  const toggleType = (type: WorkoutType) => {
    setLocalSelectedTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const handleDone = () => {
    setSelectedWorkoutTypes(localSelectedTypes);
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Dynamisches Padding-Top für den Header basierend auf der Notch */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 16, 32) }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trainingstypen</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <FlatList
        data={workoutCategories}
        keyExtractor={(item) => item.name}
        scrollEnabled={true}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: category }) => (
          <View key={category.name} style={styles.categoryContainer}>
            <Text style={styles.categoryTitle}>{category.name}</Text>
            <View style={styles.typesContainer}>
              {category.types.map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeCheckbox,
                    localSelectedTypes.includes(type.key) && styles.typeCheckboxActive
                  ]}
                  onPress={() => toggleType(type.key)}
                >
                  <View style={styles.checkboxInner}>
                    {localSelectedTypes.includes(type.key) && (
                      <Ionicons name="checkmark" size={18} color="#ffffff" />
                    )}
                  </View>
                  <Text style={styles.typeLabel}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      />

      {/* Dynamisches Padding-Bottom, damit der Button weiter oben sitzt */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 20, 36) }]}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={handleDone}
        >
          <Text style={styles.doneButtonText}>
            Fertig ({localSelectedTypes.length})
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    // paddingTop wurde ins inline-styling ausgelagert
    paddingBottom: 16,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a'
  },
  headerPlaceholder: {
    width: 28
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff'
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 120 // Wurde von 70 auf 120 erhöht, damit das Ende der Liste nicht hinter dem höheren Footer versteckt bleibt!
  },
  categoryContainer: {
    marginBottom: 28
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12
  },
  typesContainer: {
    gap: 10
  },
  typeCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3a3a3a'
  },
  typeCheckboxActive: {
    backgroundColor: '#5856D6',
    borderColor: '#5856D6'
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a'
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 25,
    paddingTop: 20,
    // paddingBottom wurde ins inline-styling ausgelagert
    borderTopWidth: 1,
    borderTopColor: '#3a3a3a'
  },
  doneButton: {
    backgroundColor: '#5856D6',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#5856D6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  doneButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold'
  }
});