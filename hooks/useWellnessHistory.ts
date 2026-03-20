import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  calculateReadinessForDate,
  getHistoryContextStart,
  ReadinessWellnessLog,
  ReadinessWorkoutLog,
  shiftIsoDate,
} from '../lib/readinessTimeline';

const PAGE_SIZE = 5;

export interface WellnessHistoryWorkoutLog extends ReadinessWorkoutLog {
  id: string | number;
  workout_types: string[] | null;
  duration_minutes: number | null;
  muscular_effort: number | null;
  respiration_effort: number | null;
  notes: string | null;
  created_at?: string | null;
}

export interface WellnessHistoryLog extends ReadinessWellnessLog {
  id?: string | number;
}

export interface WellnessHistoryDay {
  date: string;
  wellnessLog: WellnessHistoryLog | null;
  readinessScore: number | null;
  trainingLogs: WellnessHistoryWorkoutLog[];
}

interface WellnessHistoryPage {
  days: WellnessHistoryDay[];
  pageOffset: number;
  hasMore: boolean;
}

function getIsoDateFromOffset(offset: number): string {
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  base.setDate(base.getDate() - offset);
  return base.toISOString().split('T')[0];
}

function compareWorkoutLogs(a: WellnessHistoryWorkoutLog, b: WellnessHistoryWorkoutLog): number {
  if (a.created_at && b.created_at) {
    return b.created_at.localeCompare(a.created_at);
  }

  if (a.id !== undefined && b.id !== undefined) {
    return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
  }

  return 0;
}

function toWorkoutLog(row: any): WellnessHistoryWorkoutLog {
  return {
    id: row.id,
    date: row.date,
    calculated_load: row.calculated_load ?? null,
    workout_types: Array.isArray(row.workout_types) ? row.workout_types : null,
    duration_minutes: row.duration_minutes ?? null,
    muscular_effort: row.muscular_effort ?? null,
    respiration_effort: row.respiration_effort ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at ?? null,
  };
}

function toWellnessLog(row: any): WellnessHistoryLog {
  return {
    id: row.id,
    date: row.date,
    mood: row.mood,
    recovery: row.recovery,
    health_status: row.health_status,
    physical: row.physical,
    sleep: row.sleep,
    stress: row.stress,
    is_sick: !!row.is_sick,
    is_injured: !!row.is_injured,
    hrv: row.hrv ?? null,
    sleep_hours: row.sleep_hours ?? null,
    resting_hr: row.resting_hr ?? null,
  };
}

export function useWellnessHistory() {
  return useInfiniteQuery<WellnessHistoryPage, Error>({
    queryKey: ['wellnessHistory'],
    initialPageParam: 0,
    staleTime: 1000 * 90,
    gcTime: 1000 * 60 * 15,
    queryFn: async ({ pageParam }) => {
      const pageOffset = typeof pageParam === 'number' ? pageParam : 0;
      const newestVisibleDate = getIsoDateFromOffset(pageOffset);
      const oldestVisibleDate = getIsoDateFromOffset(pageOffset + PAGE_SIZE - 1);
      const contextStart = getHistoryContextStart(oldestVisibleDate);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw authError;
      }

      const user = authData.user;
      if (!user) {
        throw new Error('Nicht eingeloggt');
      }

      const [wellnessResult, workoutResult, olderWellnessResult, olderWorkoutResult] = await Promise.all([
        supabase
          .from('wellness_logs')
          .select('id, date, mood, recovery, health_status, physical, sleep, stress, is_sick, is_injured, hrv, sleep_hours, resting_hr')
          .eq('user_id', user.id)
          .gte('date', contextStart)
          .lte('date', newestVisibleDate),
        supabase
          .from('workout_logs')
          .select('id, date, workout_types, duration_minutes, muscular_effort, respiration_effort, calculated_load, notes, created_at')
          .eq('user_id', user.id)
          .gte('date', contextStart)
          .lte('date', newestVisibleDate),
        supabase
          .from('wellness_logs')
          .select('date')
          .eq('user_id', user.id)
          .lt('date', oldestVisibleDate)
          .order('date', { ascending: false })
          .limit(1),
        supabase
          .from('workout_logs')
          .select('date')
          .eq('user_id', user.id)
          .lt('date', oldestVisibleDate)
          .order('date', { ascending: false })
          .limit(1),
      ]);

      if (wellnessResult.error) {
        throw wellnessResult.error;
      }

      if (workoutResult.error) {
        throw workoutResult.error;
      }

      if (olderWellnessResult.error) {
        throw olderWellnessResult.error;
      }

      if (olderWorkoutResult.error) {
        throw olderWorkoutResult.error;
      }

      const wellnessLogs = (wellnessResult.data || []).map(toWellnessLog);
      const workoutLogs = (workoutResult.data || []).map(toWorkoutLog);

      const visibleDates = Array.from({ length: PAGE_SIZE }, (_, index) => getIsoDateFromOffset(pageOffset + index));
      const days = visibleDates.map((date) => {
        const wellnessLog = wellnessLogs.find((entry) => entry.date === date) || null;
        const trainingLogs = workoutLogs.filter((entry) => entry.date === date).sort(compareWorkoutLogs);

        return {
          date,
          wellnessLog,
          readinessScore: calculateReadinessForDate(date, wellnessLogs, workoutLogs),
          trainingLogs,
        };
      });

      return {
        days,
        pageOffset,
        hasMore: (olderWellnessResult.data || []).length > 0 || (olderWorkoutResult.data || []).length > 0,
      };
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) {
        return undefined;
      }

      return lastPage.pageOffset + PAGE_SIZE;
    },
  });
}