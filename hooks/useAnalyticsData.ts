import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { calculateReadiness } from '../lib/calculations';
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
      const toNumericLoad = (value: unknown): number => {
        const n = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(n) ? n : 0;
      };

      const today = getIsoDate(0);
      const ninetyDaysAgoStr = getIsoDate(90);
      const thirteenDaysAgoStr = getIsoDate(13);
      const sixDaysAgoStr = getIsoDate(6);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      // Fetch all wellness & workout data for the period
      const [wellnessData, workoutData] = await Promise.all([
        supabase
          .from('wellness_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', ninetyDaysAgoStr)
          .lte('date', today),
        supabase
          .from('workout_logs')
          .select('date, calculated_load')
          .eq('user_id', user.id)
          .gte('date', ninetyDaysAgoStr)
          .lte('date', today),
      ]);

      if (!wellnessData.data || !workoutData.data) {
        throw new Error("Fehler beim Abrufen der Daten");
      }

      // Build a map of dates to workout loads
      const workoutMap = new Map<string, number>();
      workoutData.data.forEach((w) => {
        const currentLoad = workoutMap.get(w.date) || 0;
        workoutMap.set(w.date, currentLoad + toNumericLoad(w.calculated_load));
      });

      // Calculate baselines (30-day averages for HRV and RHR)
      const thirtyDaysAgoStr = getIsoDate(30);
      const last30DaysWellness = wellnessData.data.filter(w => w.date >= thirtyDaysAgoStr);
      const avgHrv = last30DaysWellness
        .filter(w => w.hrv)
        .reduce((sum, w, _, arr) => sum + (w.hrv || 0) / arr.length, 0) || 60;
      const avgRhr = last30DaysWellness
        .filter(w => w.resting_hr)
        .reduce((sum, w, _, arr) => sum + (w.resting_hr || 0) / arr.length, 0) || 60;

      // Calculate readiness for each day
      const readinessData: ChartDataPoint[] = [];

      wellnessData.data.forEach((wellness) => {
        const daysFromToday = Math.floor((new Date(today).getTime() - new Date(wellness.date).getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate loads for ACWR
        const currentDayLoad = workoutMap.get(wellness.date) || 0;
        
        // Past 6 days load (excluding current day)
        let pastSixDaysLoad = 0;
        for (let i = 1; i <= 6; i++) {
          const pastDate = getIsoDate(daysFromToday + i);
          pastSixDaysLoad += workoutMap.get(pastDate) || 0;
        }

        // Past 13 days load (excluding current day)
        let pastThirteenDaysLoad = 0;
        for (let i = 1; i <= 13; i++) {
          const pastDate = getIsoDate(daysFromToday + i);
          pastThirteenDaysLoad += workoutMap.get(pastDate) || 0;
        }

        const readiness = calculateReadiness(
          {
            mood: wellness.mood || 5,
            recovery: wellness.recovery || 5,
            health: wellness.health_status || 5,
            physical: wellness.physical || 5,
            sleep: wellness.sleep || 5,
            stress: wellness.stress || 5,
            isSick: wellness.is_sick || false,
          },
          {
            hrv: wellness.hrv,
            restingHr: wellness.resting_hr,
            sleepHours: wellness.sleep_hours,
            baselineHrv: avgHrv,
            baselineRhr: avgRhr,
          },
          currentDayLoad,
          pastSixDaysLoad,
          pastThirteenDaysLoad
        );

        readinessData.push({
          date: wellness.date,
          readiness,
          load: currentDayLoad,
        });
      });

      // Sort by date ascending
      readinessData.sort((a, b) => a.date.localeCompare(b.date));

      // Aggregate based on period
      const chartData = aggregateData(readinessData, period);

      return chartData;
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
