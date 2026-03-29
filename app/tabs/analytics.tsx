import { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useAnalyticsData, ChartDataPoint } from '../../hooks/useAnalyticsData';
import { ReadinessLoadChart } from '../../components/analytics/ReadinessLoadChart';

type Period = 'week' | 'month' | 'quarter';

export default function AnalyticsScreen() {
  const route = useRoute();
  const initialPeriod = (route.params as any)?.initialPeriod || 'week';
  const [period, setPeriod] = useState<Period>(initialPeriod as Period);
  const [selectedChartIndex, setSelectedChartIndex] = useState<number | null>(null);
  const [dismissSignal, setDismissSignal] = useState(0);
  const { data, isLoading, error, refetch } = useAnalyticsData(period);

  // Refresh data when tab comes into focus
  useFocusEffect(() => {
    refetch();
  });

  const PeriodButton = ({ label, value }: { label: string; value: Period }) => {
    const isActive = period === value;
    return (
      <Pressable
        onPress={() => setPeriod(value)}
        style={{
          flex: 1,
          paddingVertical: 12,
          backgroundColor: isActive ? '#5856D6' : '#1f2a4a',
          borderWidth: 1,
          borderColor: isActive ? '#5856D6' : '#3a4a6a',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: isActive ? '#fff' : '#9ec5ff', fontSize: 14, fontWeight: isActive ? '600' : '500' }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <Pressable
        style={{ flex: 1 }}
        onPress={() => {
          setSelectedChartIndex(null);
          setDismissSignal(v => v + 1);
        }}
      >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 20 }}>
            Readiness & Last
          </Text>

          {/* Period Selector */}
          <View style={{ flexDirection: 'row', marginBottom: 20, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1f2a4a', borderWidth: 1, borderColor: '#3a4a6a' }}>
            <PeriodButton label="Woche" value="week" />
            <PeriodButton label="Monat" value="month" />
            <PeriodButton label="Quartal" value="quarter" />
          </View>
        </View>

        {/* Chart Section */}
        <View style={{ paddingHorizontal: 0 }}>
          {isLoading ? (
            <View style={{ height: 300, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#2f95dc" />
              <Text style={{ color: '#999', marginTop: 10 }}>Daten werden geladen...</Text>
            </View>
          ) : error ? (
            <View style={{ height: 300, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
              <Text style={{ color: '#f44336', fontSize: 16, textAlign: 'center', marginBottom: 12 }}>
                Fehler beim Laden der Daten
              </Text>
              <Pressable
                onPress={() => refetch()}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: '#2f95dc',
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14 }}>Erneut versuchen</Text>
              </Pressable>
            </View>
          ) : data ? (
            <>
              <ReadinessLoadChart
                data={data}
                period={period}
                selectedIndex={selectedChartIndex}
                onSelectedIndexChange={setSelectedChartIndex}
                dismissSignal={dismissSignal}
              />

              {/* Info Section */}
              <View style={{ marginTop: 12, paddingHorizontal: 20 }}>
                <View style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, gap: 10 }}>
                  {/* Werte-Reihe */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-evenly' }}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Ø Readiness</Text>
                      <Text style={{ color: '#2f95dc', fontSize: 18, fontWeight: '600' }}>
                        {Math.round(data.reduce((sum: number, d: ChartDataPoint) => sum + d.readiness, 0) / data.length)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Ø Last</Text>
                      <Text style={{ color: '#5856D6', fontSize: 18, fontWeight: '600' }}>
                        {Math.round(data.reduce((sum: number, d: ChartDataPoint) => sum + d.load, 0) / data.length)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Gesamt Last</Text>
                      <Text style={{ color: '#5856D6', fontSize: 18, fontWeight: '600' }}>
                        {Math.round(data.reduce((sum: number, d: ChartDataPoint) => sum + d.load, 0))}
                      </Text>
                    </View>
                  </View>

                  {/* Trennlinie */}
                  <View style={{ height: 1, backgroundColor: '#2a2a2a' }} />

                  {/* Beschreibungstext */}
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: '#666', fontSize: 11, lineHeight: 16 }}>
                      <Text style={{ color: '#5856D6', fontWeight: '600' }}>Last (Balken):</Text> Trainingsbelastung pro Tag/Woche
                    </Text>
                    <Text style={{ color: '#666', fontSize: 11, lineHeight: 16 }}>
                      <Text style={{ color: '#2f95dc', fontWeight: '600' }}>Readiness Score (Linie):</Text> Bereitschaft für Training basierend auf subjektiven und objektiven Metriken (0-100)
                    </Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
      </Pressable>
    </SafeAreaView>
  );
}
