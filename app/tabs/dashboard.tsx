import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDashboardData } from '../../hooks/useDashboardData';
import { ReadinessGauge } from '../../components/dashboard/ReadinessGauge';
import { StatCard } from '../../components/dashboard/StatCard';
import { formatGermanDate } from '../../utils/dateHelpers';

export default function Dashboard() {
  // isLoading: Erster Load (keine Daten im Cache)
  // isRefetching: Update im Hintergrund
  const { data, isLoading, refetch } = useDashboardData();
  const [selectedDay, setSelectedDay] = useState<{date: string, load: number} | null>(null);
  const router = useRouter();

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
                  <View style={[styles.percentageBadge, { backgroundColor: data.percentageChange >= 0 ? '#e8f5e9' : '#fff3e0' }]}>
                    <Ionicons name={data.percentageChange >= 0 ? "trending-up" : "trending-down"} size={14} color={data.percentageChange >= 0 ? "#2e7d32" : "#e65100"} />
                    <Text style={[styles.percentageText, { color: data.percentageChange >= 0 ? "#2e7d32" : "#e65100" }]}>
                      {data.percentageChange >= 0 ? '+' : ''}{Math.round(data.percentageChange)}%
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.chartRow}>
              {data.weeklyLoadData.map((day, idx) => (
                <TouchableOpacity key={idx} style={styles.barColumn} onPress={() => setSelectedDay(selectedDay?.date === day.date ? null : day)}>
                  <View style={[styles.bar, { 
                    height: Math.max(5, Math.min(day.load / 10, 80)), 
                    backgroundColor: day.load > 800 ? '#F44336' : '#5856D6', 
                    opacity: selectedDay ? (selectedDay.date === day.date ? 1 : 0.4) : 1 
                  }]} />
                  <Text style={styles.barDate}>{day.date.split('-')[2]}</Text>
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
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    dateText: { fontSize: 16, color: '#6c757d', marginBottom: 5, textAlign: 'center' },
    statusRow: { alignItems: 'center', marginBottom: 15 },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, borderWidth: 1 },
    badgeSuccess: { backgroundColor: '#e8f5e9', borderColor: '#c8e6c9' },
    badgeWait: { backgroundColor: '#fff3e0', borderColor: '#ffe0b2' },
    badgeText: { fontSize: 12, fontWeight: '600' },
    mainContent: { alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
    actionContainer: { marginTop: 10, marginBottom: 25, gap: 12 },
    logButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    trainingButton: { backgroundColor: '#5856D6' },
    logButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    completedBox: { padding: 16, borderRadius: 15, backgroundColor: '#e8f5e9', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    completedText: { color: '#2e7d32', fontSize: 16, fontWeight: '600' },
    trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    trendCard: { backgroundColor: 'white', padding: 15, borderRadius: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    trendTitle: { fontSize: 14, fontWeight: '700', color: '#6c757d', marginBottom: 15 },
    chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
    barColumn: { alignItems: 'center', width: '12%' },
    bar: { width: '80%', borderRadius: 4 },
    barDate: { fontSize: 10, color: '#adb5bd', marginTop: 5 },
    loadSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    totalLoadText: { fontSize: 22, fontWeight: '800', color: '#212529' },
    percentageBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
    percentageText: { fontSize: 12, fontWeight: '700' },
    detailsSection: { marginTop: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 15 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
    statCard: { backgroundColor: 'white', width: '48%', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
    iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    statLabel: { fontSize: 12, color: '#6c757d' },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#212529' },
    statUnit: { fontSize: 12, fontWeight: 'normal', color: '#6c757d' }
});