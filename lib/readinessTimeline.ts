import { calculateReadiness } from './calculations';

export interface ReadinessWellnessLog {
  date: string;
  mood: number;
  recovery: number;
  health_status: number;
  physical: number;
  sleep: number;
  stress: number;
  is_sick: boolean;
  is_injured: boolean;
  hrv: number | null;
  sleep_hours: number | null;
  resting_hr: number | null;
}

export interface ReadinessWorkoutLog {
  id?: string | number;
  date: string;
  calculated_load: number | null;
}

const LOAD_WINDOW_DAYS = 13;
const BASELINE_WINDOW_DAYS = 30;

function toNumeric(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

export function shiftIsoDate(date: string, days: number): string {
  return addDays(parseIsoDate(date), days).toISOString().split('T')[0];
}

export function getHistoryContextStart(date: string): string {
  return shiftIsoDate(date, -BASELINE_WINDOW_DAYS);
}

function isDateWithinRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function calculateReadinessForDate(
  date: string,
  wellnessLogs: ReadinessWellnessLog[],
  workoutLogs: ReadinessWorkoutLog[]
): number | null {
  const currentWellness = wellnessLogs.find((entry) => entry.date === date);
  if (!currentWellness) {
    return null;
  }

  const baselineStart = shiftIsoDate(date, -BASELINE_WINDOW_DAYS);
  const loadWindowStart = shiftIsoDate(date, -LOAD_WINDOW_DAYS);
  const previousWeekStart = shiftIsoDate(date, -6);
  const previousDay = shiftIsoDate(date, -1);

  const baselineRows = wellnessLogs.filter((entry) => isDateWithinRange(entry.date, baselineStart, date));
  const hrvRows = baselineRows.filter((entry) => typeof entry.hrv === 'number' && entry.hrv > 0);
  const rhrRows = baselineRows.filter((entry) => typeof entry.resting_hr === 'number' && entry.resting_hr > 0);

  const baselineHrv = hrvRows.length > 0
    ? hrvRows.reduce((sum, entry) => sum + (entry.hrv || 0), 0) / hrvRows.length
    : 60;
  const baselineRhr = rhrRows.length > 0
    ? rhrRows.reduce((sum, entry) => sum + (entry.resting_hr || 0), 0) / rhrRows.length
    : 60;

  const currentDayLoad = workoutLogs
    .filter((entry) => entry.date === date)
    .reduce((sum, entry) => sum + toNumeric(entry.calculated_load), 0);

  const pastSixDaysLoad = workoutLogs
    .filter((entry) => isDateWithinRange(entry.date, previousWeekStart, previousDay))
    .reduce((sum, entry) => sum + toNumeric(entry.calculated_load), 0);

  const pastThirteenDaysLoad = workoutLogs
    .filter((entry) => isDateWithinRange(entry.date, loadWindowStart, previousDay))
    .reduce((sum, entry) => sum + toNumeric(entry.calculated_load), 0);

  return calculateReadiness(
    {
      mood: currentWellness.mood,
      recovery: currentWellness.recovery,
      health: currentWellness.health_status,
      physical: currentWellness.physical,
      sleep: currentWellness.sleep,
      stress: currentWellness.stress,
      isSick: currentWellness.is_sick,
    },
    {
      hrv: currentWellness.hrv,
      sleepHours: currentWellness.sleep_hours,
      restingHr: currentWellness.resting_hr,
      baselineHrv,
      baselineRhr,
    },
    currentDayLoad,
    pastSixDaysLoad,
    pastThirteenDaysLoad
  );
}
