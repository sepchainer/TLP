import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { fetchFitbitWellnessData } from '../../lib/fitbit_sync';
import { calculateReadiness } from '../../lib/calculations';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const ReadinessGauge = ({ score }: { score: number }) => {
  const size = 200;
  const strokeWidth = 15;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const getColor = (s: number) => {
    if (s > 70) return '#4CAF50';
    if (s > 40) return '#FF9800';
    return '#F44336';
  };

  return (
    <View style={styles.gaugeContainer}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={radius} stroke="#e9ecef" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={center} cy={center} r={radius}
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.scoreTextContainer}>
        <Text style={styles.scoreValue}>{score}</Text>
        <Text style={styles.scoreLabel}>Readiness</Text>
      </View>
    </View>
  );
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [hasLoggedToday, setHasLoggedToday] = useState(false);
  const [readinessScore, setReadinessScore] = useState<number>(0);
  const [todayLoad, setTodayLoad] = useState(0); 
  const [fitbitData, setFitbitData] = useState<any>(null);
  const [weeklyLoadData, setWeeklyLoadData] = useState<{date: string, load: number}[]>([]);
  const [selectedDay, setSelectedDay] = useState<{date: string, load: number} | null>(null);
  const [currentWeekTotal, setCurrentWeekTotal] = useState(0);
  const [percentageChange, setPercentageChange] = useState(0);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  async function loadDashboardData() {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      // Zeiträume berechnen
      const sevenDaysAgoDate = new Date();
      sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
      const sevenDaysAgo = sevenDaysAgoDate.toISOString().split('T')[0];

      const fourteenDaysAgoDate = new Date();
      fourteenDaysAgoDate.setDate(fourteenDaysAgoDate.getDate() - 14);
      const fourteenDaysAgo = fourteenDaysAgoDate.toISOString().split('T')[0];

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Wir holen jetzt Daten für 14 Tage (gte fourteenDaysAgo)
        const [wellnessCheck, fitbitCheck, workoutsToday, workouts14d] = await Promise.all([
          supabase.from('wellness_logs').select('*').eq('user_id', user.id).eq('date', today).single(),
          fetchFitbitWellnessData(user.id),
          supabase.from('workout_logs').select('calculated_load').eq('user_id', user.id).eq('date', today),
          supabase.from('workout_logs').select('date, calculated_load').eq('user_id', user.id).gte('date', fourteenDaysAgo)
        ]);
        
        // 1. Load Summen & Wochenvergleich
        const currentLoad = workoutsToday.data?.reduce((sum, item) => sum + (item.calculated_load || 0), 0) || 0;
        setTodayLoad(currentLoad);

        // Aktuelle Woche (heute eingeschlossen: letzten 7 Tage)
        const thisWeekWorkouts = workouts14d.data?.filter(w => w.date >= sevenDaysAgo) || [];
        const thisWeekTotal = thisWeekWorkouts.reduce((sum, item) => sum + (item.calculated_load || 0), 0);
        setCurrentWeekTotal(thisWeekTotal);

        // Vorwoche (Daten zwischen -14 und -7 Tagen)
        const lastWeekWorkouts = workouts14d.data?.filter(w => w.date >= fourteenDaysAgo && w.date < sevenDaysAgo) || [];
        const lastWeekTotal = lastWeekWorkouts.reduce((sum, item) => sum + (item.calculated_load || 0), 0);

        // Prozentuale Veränderung berechnen
        if (lastWeekTotal > 0) {
          const change = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
          setPercentageChange(change);
        } else {
          setPercentageChange(thisWeekTotal > 0 ? 100 : 0); // 100% wenn in der Vorwoche nichts war
        }

        const total14dLoad = workouts14d.data?.reduce((sum, item) => sum + (item.calculated_load || 0), 0) || 0;

        // 2. Wochentrend für das Balkendiagramm aufbereiten
        const trend = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dStr = d.toISOString().split('T')[0];
          // Filtere aus den 14-Tage-Daten den jeweiligen Tag raus
          const load = workouts14d.data?.filter(w => w.date === dStr).reduce((s, x) => s + x.calculated_load, 0) || 0;
          trend.push({ date: dStr, load: load });
        }
        setWeeklyLoadData(trend);

        // 3. Fitbit & Readiness
        if (fitbitCheck) setFitbitData(fitbitCheck);

        if (wellnessCheck.data) {
          setHasLoggedToday(true);
          // Für die Readiness-Fatigue nutzen wir die Last der letzten 7 Tage (ohne heute)
          const pastSevenDaysLoad = thisWeekTotal - currentLoad; 

          const liveScore = calculateReadiness(
            {
              mood: wellnessCheck.data.mood,
              recovery: wellnessCheck.data.recovery,
              health: wellnessCheck.data.health_status,
              physical: wellnessCheck.data.physical,
              sleep: wellnessCheck.data.sleep,
              stress: wellnessCheck.data.stress,
              isSick: wellnessCheck.data.is_sick
            },
            fitbitCheck || undefined,
            currentLoad,
            pastSevenDaysLoad,
            total14dLoad - currentLoad   // Letzte 14 Tage (exkl. heute)
          );
          setReadinessScore(liveScore);
        } else {
          setHasLoggedToday(false);
          setReadinessScore(0);
        }
      }
    } catch (error) {
      console.error("Fehler beim Laden:", error);
    } finally {
      setLoading(false);
    }
  }

  const StatCard = ({ icon, label, value, unit, color }: any) => (
    <View style={styles.statCard}>
      <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value ?? '--'} <Text style={styles.statUnit}>{unit}</Text></Text>
      </View>
    </View>
  );

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator size="large" color="#007AFF" /></View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Pressable onPress={() => setSelectedDay(null)} style={{ flex: 1 }}>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>

        <View style={styles.statusRow}>
          <View style={[styles.badge, fitbitData?.hrv ? styles.badgeSuccess : styles.badgeWait]}>
            <Ionicons name={fitbitData?.hrv ? "checkmark-circle" : "time"} size={14} color={fitbitData?.hrv ? "#2e7d32" : "#a66a00"} />
            <Text style={[styles.badgeText, { color: fitbitData?.hrv ? "#2e7d32" : "#a66a00" }]}>
              {fitbitData?.hrv ? "Fitbit Daten bereit" : "Sync ausstehend..."}
            </Text>
          </View>
        </View>
        
        <View style={styles.mainContent}>
          <ReadinessGauge score={readinessScore} />
        </View>

        {/* ACTION BUTTONS - Jetzt nach oben verschoben */}
        <View style={styles.actionContainer}>
          {!hasLoggedToday ? (
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

          <TouchableOpacity 
            style={[styles.logButton, styles.trainingButton]} 
            onPress={() => router.push('/training_modal')}
          >
            <Ionicons name="fitness-outline" size={24} color="white" />
            <Text style={styles.logButtonText}>Training loggen</Text>
          </TouchableOpacity>
        </View>

        {/* 7-TAGE TREND BAR CHART */}
        <View style={styles.trendCard}>
          {/* Wichtig: Klick auf die Karte selbst stoppt das "Durchreichen" zum Hintergrund */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.trendHeader}>
              <View>
                <Text style={styles.trendTitle}>Wochen-Belastung</Text>
                <View style={styles.loadSummaryRow}>
                  <Text style={styles.totalLoadText}>{Math.round(currentWeekTotal)} pts</Text>
                  
                  {/* Prozentuale Veränderung neben der Summe */}
                  <View style={[
                    styles.percentageBadge, 
                    { backgroundColor: percentageChange >= 0 ? '#e8f5e9' : '#fff3e0' }
                  ]}>
                    <Ionicons 
                      name={percentageChange >= 0 ? "trending-up" : "trending-down"} 
                      size={14} 
                      color={percentageChange >= 0 ? "#2e7d32" : "#e65100"} 
                    />
                    <Text style={[
                      styles.percentageText, 
                      { color: percentageChange >= 0 ? "#2e7d32" : "#e65100" }
                    ]}>
                      {percentageChange >= 0 ? '+' : ''}{Math.round(percentageChange)}%
                    </Text>
                  </View>
                </View>
              </View>

              {/* Detail-Anzeige bei Auswahl (nach rechts gerückt) */}
              {selectedDay && (
                <TouchableOpacity onPress={() => setSelectedDay(null)} style={styles.selectedInfo}>
                  <Text style={styles.selectedText}>
                    {selectedDay.date.split('-')[2]}.{selectedDay.date.split('-')[1]}.: 
                    <Text style={styles.selectedLoad}> {Math.round(selectedDay.load)} pts</Text>
                  </Text>
                  <Ionicons name="close-circle" size={14} color="#adb5bd" style={{marginLeft: 5}} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.chartRow}>
              {weeklyLoadData.map((day, idx) => {
                const isSelected = selectedDay?.date === day.date;
                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={styles.barColumn}
                    onPress={() => {
                      // Toggle Logik: Wenn schon selektiert, dann null, sonst neu setzen
                      setSelectedDay(selectedDay?.date === day.date ? null : day);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.bar, 
                      { 
                        height: Math.max(5, Math.min(day.load / 10, 80)), 
                        backgroundColor: day.load > 800 ? '#F44336' : '#5856D6',
                        opacity: selectedDay ? (isSelected ? 1 : 0.4) : 1,
                      },
                      isSelected && styles.activeBarBorder
                    ]} />
                    <Text style={[styles.barDate, isSelected && styles.selectedBarDate]}>
                      {day.date.split('-')[2]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </View>

        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Metriken heute</Text>
          <View style={styles.statsGrid}>
            <StatCard icon="flame-outline" label="Tages-Last" value={todayLoad} unit="pts" color="#FF9800" />
            <StatCard icon="heart-outline" label="HRV (RMSSD)" value={fitbitData?.hrv} unit="ms" color="#E91E63" />
            <StatCard icon="moon-outline" label="Schlaf" value={fitbitData?.sleepHours} unit="h" color="#9C27B0" />
            <StatCard icon="pulse-outline" label="Ruhepuls" value={fitbitData?.restingHr} unit="bpm" color="#F44336" />
          </View>
        </View>
      </Pressable>
    </ScrollView>
  );
}

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
  gaugeContainer: { alignItems: 'center', justifyContent: 'center' },
  scoreTextContainer: { position: 'absolute', alignItems: 'center' },
  scoreValue: { fontSize: 58, fontWeight: 'bold', color: '#212529' },
  scoreLabel: { fontSize: 14, color: '#adb5bd', textTransform: 'uppercase' },
  
  actionContainer: { marginTop: 10, marginBottom: 25, gap: 12 }, // Mehr Abstand nach unten zum Chart
  logButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  trainingButton: { backgroundColor: '#5856D6' },
  logButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  completedBox: { padding: 16, borderRadius: 15, backgroundColor: '#e8f5e9', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  completedText: { color: '#2e7d32', fontSize: 16, fontWeight: '600' },

  trendHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 20 
  },
  trendCard: { backgroundColor: 'white', padding: 15, borderRadius: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  trendTitle: { fontSize: 14, fontWeight: '700', color: '#6c757d', marginBottom: 15 },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
  barColumn: { alignItems: 'center', width: '12%' },
  bar: { width: '80%', borderRadius: 4 },
  barDate: { fontSize: 10, color: '#adb5bd', marginTop: 5 },
  selectedBarDate: {
    color: '#212529',
    fontWeight: 'bold'
  },
  activeBarBorder: {
    borderWidth: 2,
    borderColor: '#212529',
    shadowColor: '#5856D6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  selectedInfo: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 4,
  },
  selectedText: { fontSize: 12, color: '#495057', fontWeight: '600' },
  selectedLoad: { color: '#5856D6', fontWeight: 'bold' },
  loadSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  totalLoadText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#212529',
  },
  percentageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '700',
  },

  detailsSection: { marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 15 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  statCard: { backgroundColor: 'white', width: '48%', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#6c757d' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#212529' },
  statUnit: { fontSize: 12, fontWeight: 'normal', color: '#6c757d' }
});