import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchFitbitWellnessData, fetchFitbitWorkouts } from '../lib/fitbit_sync';
import { calculateReadiness } from '../lib/calculations';
import { getIsoDate, formatGermanDate } from '../utils/dateHelpers';

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      const toNumericLoad = (value: unknown): number => {
        const n = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(n) ? n : 0;
      };

      const fitbitMarkerRegex = /\[fitbit_log_id:([^\]]+)\]/g;
      const extractFitbitIds = (note: string | null | undefined): string[] => {
        if (!note) return [];
        const matches = Array.from(note.matchAll(fitbitMarkerRegex));
        return matches
          .map((match) => (match[1] || '').trim())
          .filter((id) => !!id);
      };

      const today = getIsoDate(0);
      const sixDaysAgoStr = getIsoDate(6);
      const thirteenDaysAgoStr = getIsoDate(13);
      const thirtyDaysAgoStr = getIsoDate(30);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt");

      const [wellnessToday, wellnessHistory, workouts14d, fitbitRealtime, fitbitWorkouts, todayWorkoutNotes] = await Promise.all([
        supabase.from('wellness_logs').select('*').eq('user_id', user.id).eq('date', today).single(),
        supabase.from('wellness_logs').select('hrv, resting_hr').eq('user_id', user.id).gte('date', thirtyDaysAgoStr),
        supabase.from('workout_logs').select('date, calculated_load').eq('user_id', user.id).gte('date', thirteenDaysAgoStr),
        fetchFitbitWellnessData(user.id),
        fetchFitbitWorkouts(user.id),
        supabase.from('workout_logs').select('notes').eq('user_id', user.id).eq('date', today)
      ]);

      const linkedFitbitWorkoutIds = Array.from(
        new Set((todayWorkoutNotes.data || []).flatMap((entry) => extractFitbitIds(entry.notes)))
      );

      const workouts = (workouts14d.data || []).map((w) => ({
        ...w,
        numericLoad: toNumericLoad((w as any).calculated_load),
      }));
      const currentLoad = workouts.filter(w => w.date === today).reduce((s, i) => s + i.numericLoad, 0);
      const thisWeekTotal = workouts.filter(w => w.date >= sixDaysAgoStr).reduce((s, i) => s + i.numericLoad, 0);
      const lastWeekTotal = workouts.filter(w => w.date >= thirteenDaysAgoStr && w.date < sixDaysAgoStr).reduce((s, i) => s + i.numericLoad, 0);
      
      // NEU: Gesamte Last der letzten 14 Tage berechnen
      const total14dLoad = workouts.reduce((s, i) => s + i.numericLoad, 0);

      const history = wellnessHistory.data || [];
      const avgHrv = history.filter(h => h.hrv).reduce((s, i, _, a) => s + i.hrv! / a.length, 0) || 60;
      const avgRhr = history.filter(h => h.resting_hr).reduce((s, i, _, a) => s + i.resting_hr! / a.length, 0) || 60;

      let finalReadinessScore = 0;
      let hasLoggedToday = false;

      if (wellnessToday.data) {
        hasLoggedToday = true;
        const data = wellnessToday.data;
        const hrv = fitbitRealtime?.hrv || data.hrv;
        const rhr = fitbitRealtime?.restingHr || data.resting_hr;

        finalReadinessScore = calculateReadiness(
          { mood: data.mood, recovery: data.recovery, health: data.health_status, physical: data.physical, sleep: data.sleep, stress: data.stress, isSick: data.is_sick },
          { hrv, restingHr: rhr, sleepHours: fitbitRealtime?.sleepHours || data.sleep_hours, baselineHrv: avgHrv, baselineRhr: avgRhr },
          currentLoad, 
          thisWeekTotal - currentLoad, 
          total14dLoad - currentLoad // pastThirteenDaysLoad
        );
      }

      const trend = [];
      for (let i = 6; i >= 0; i--) {
        const dStr = getIsoDate(i);
        const load = workouts.filter(w => w.date === dStr).reduce((s, x) => s + x.numericLoad, 0);
        trend.push({ date: dStr, load });
      }

      return {
        userId: user.id,
        today,
        hasLoggedToday,
        readinessScore: finalReadinessScore,
        todayLoad: currentLoad,
        fitbitData: fitbitRealtime,
        fitbitWorkouts,
        linkedFitbitWorkoutIds,
        weeklyLoadData: trend,
        currentWeekTotal: thisWeekTotal,
        total14dLoad, // <--- Jetzt für das Modal verfügbar
        avgHrv,       // <--- Jetzt für das Modal verfügbar
        avgRhr,       // <--- Jetzt für das Modal verfügbar
        percentageChange: lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : 0,
        formattedDate: formatGermanDate(new Date())
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}