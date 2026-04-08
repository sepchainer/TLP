import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { calculateReadinessForDate, getHistoryContextStart, ReadinessWellnessLog, ReadinessWorkoutLog } from '../lib/readinessTimeline';
import { getIsoDate } from '../utils/dateHelpers';

export interface ChartDataPoint {
  date: string;
  readiness: number;
  load: number;
}

type Period = 'week' | 'month' | 'quarter';

export function useAnalyticsData(period: Period = 'week') {
  return useQuery({
    queryKey: ['analyticsData', period],
    queryFn: async () => {
      const today = getIsoDate(0);
      const ninetyDaysAgoStr = getIsoDate(90);
      const contextStart = getHistoryContextStart(ninetyDaysAgoStr);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      const [wellnessData, workoutData] = await Promise.all([
        supabase
          .from('wellness_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', contextStart)
          .lte('date', today),
        supabase
          .from('workout_logs')
          .select('date, calculated_load')
          .eq('user_id', user.id)
          .gte('date', contextStart)
          .lte('date', today),
      ]);

      if (!wellnessData.data || !workoutData.data) {
        throw new Error("Fehler beim Abrufen der Daten");
      }

      const readinessData: ChartDataPoint[] = [];
      const visibleWellnessLogs = (wellnessData.data || []).filter((entry) => entry.date >= ninetyDaysAgoStr);
      const wellnessLogs = (wellnessData.data || []) as ReadinessWellnessLog[];
      const workoutLogs = (workoutData.data || []) as ReadinessWorkoutLog[];

      visibleWellnessLogs.forEach((wellness) => {
        const readiness = calculateReadinessForDate(wellness.date, wellnessLogs, workoutLogs);
        const currentDayLoad = workoutLogs
          .filter((entry) => entry.date === wellness.date)
          .reduce((sum, entry) => sum + (entry.calculated_load ?? 0), 0);

        if (readiness === null) {
          return;
        }

        readinessData.push({
          date: wellness.date,
          readiness,
          load: currentDayLoad,
        });
      });

      readinessData.sort((a, b) => a.date.localeCompare(b.date));

      return aggregateData(readinessData, period);
    },
    staleTime: 1000 * 60 * 15, // Cache for 15 minutes (longer than dashboard)
  });
}

function aggregateData(data: ChartDataPoint[], period: Period): ChartDataPoint[] {
  if (period === 'week') {
    // Last 7 days, daily
    return data.slice(-7);
  }

  if (period === 'month') {
    // Last 30 days, daily
    return data.slice(-30);
  }

  if (period === 'quarter') {
    // Last 90 days, aggregated by week
    const weeks: { [key: string]: ChartDataPoint[] } = {};

    data.forEach((point) => {
      const date = new Date(point.date);
      // Get Monday of the week
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(date.setDate(diff));
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeks[weekKey]) {
        weeks[weekKey] = [];
      }
      weeks[weekKey].push(point);
    });

    // Aggregate each week
    return Object.values(weeks)
      .map((weekData) => {
        const avgReadiness = weekData.reduce((sum, d) => sum + d.readiness, 0) / weekData.length;
        const totalLoad = weekData.reduce((sum, d) => sum + d.load, 0);
        return {
          date: weekData[0].date, // Use Monday's date
          readiness: Math.round(avgReadiness),
          load: totalLoad,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  return data;
}
