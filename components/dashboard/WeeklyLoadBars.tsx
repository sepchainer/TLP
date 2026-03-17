import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BAR_HEIGHT = 80;
const MIN_FILL_HEIGHT = 10;

export interface WeeklyLoadDay {
  date: string;
  load: number;
}

interface WeeklyLoadBarsProps {
  days: WeeklyLoadDay[];
  selectedDate?: string | null;
  onSelectDay: (day: WeeklyLoadDay) => void;
  dailyTarget?: number;
}

export const WeeklyLoadBars = ({
  days,
  selectedDate,
  onSelectDay,
  dailyTarget = 100,
}: WeeklyLoadBarsProps) => {
  return (
    <View style={styles.chartRow}>
      {days.map((day) => {
        const safeTarget = dailyTarget > 0 ? dailyTarget : 100;
        const parsedLoad = typeof day.load === 'number' ? day.load : Number(day.load);
        const safeLoad = Number.isFinite(parsedLoad) ? parsedLoad : 0;
        const fillRatio = Math.max(0, Math.min(safeLoad / safeTarget, 1));
        const fillHeight = safeLoad > 0
          ? Math.max(MIN_FILL_HEIGHT, Math.round(fillRatio * BAR_HEIGHT))
          : 0;
        const isSelected = selectedDate === day.date;
        const isDimmed = !!selectedDate && !isSelected;
        const showCheck = safeLoad >= safeTarget && fillHeight > 0;

        return (
          <TouchableOpacity
            key={day.date}
            style={[styles.barColumn, isDimmed && styles.dimmedColumn]}
            activeOpacity={0.85}
            onPress={() => onSelectDay(day)}
          >
            <View style={[styles.track, isSelected && styles.selectedTrack]}>
              <View style={[styles.fill, { height: fillHeight }]}>
                {showCheck ? (
                  <View style={styles.checkContainer}>
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  </View>
                ) : null}
              </View>
            </View>
            <Text style={[styles.barDate, isSelected && styles.selectedBarDate]}>
              {parseInt(day.date.split('-')[2], 10)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
  },
  barColumn: {
    alignItems: 'center',
    width: '12%',
  },
  dimmedColumn: {
    opacity: 0.4,
  },
  track: {
    width: '80%',
    height: BAR_HEIGHT,
    borderRadius: 6,
    backgroundColor: '#3a3a3a',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedTrack: {
    borderColor: '#7c7aff',
  },
  fill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#5856D6',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  barDate: {
    fontSize: 10,
    color: '#666666',
    marginTop: 5,
  },
  selectedBarDate: {
    color: '#ffffff',
    fontWeight: '700',
  },
});