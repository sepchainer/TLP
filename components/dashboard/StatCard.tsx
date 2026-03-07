// components/dashboard/StatCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatCardProps {
  icon: any;
  label: string;
  value: string | number | null | undefined;
  unit: string;
  color: string;
}

export const StatCard = ({ icon, label, value, unit, color }: StatCardProps) => (
  <View style={styles.statCard}>
    <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value ?? '--'} <Text style={styles.statUnit}>{unit}</Text>
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  statCard: { 
    backgroundColor: '#2a2a2a', 
    width: '48%', 
    padding: 15, 
    borderRadius: 15, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 5 
  },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#888888' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  statUnit: { fontSize: 12, fontWeight: 'normal', color: '#888888' }
});