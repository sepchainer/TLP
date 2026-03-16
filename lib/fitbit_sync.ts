// libs/fitbit_sync.ts
import { supabase } from './supabase';

interface FitbitTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  tokens_stored?: boolean;
  token_refreshed?: boolean;
}

interface FitbitNotConnectedResponse {
  connected: false;
  token_refreshed: false;
  reason: 'not_connected' | 'reauthorization_required';
}

interface FitbitErrorPayload {
  error?: string;
  errors?: Array<{ message?: string }>;
}

interface FitbitActivityListItem {
  logId?: number;
  activityName?: string;
  startTime?: string;
  duration?: number;
  calories?: number;
  activityTypeId?: number;
  logType?: 'manual' | 'mobile_run' | 'tracker' | string;
}

interface FitbitActivityListResponse {
  activities?: FitbitActivityListItem[];
}

export interface FitbitWorkout {
  fitbitLogId: string;
  activityName: string;
  startTime: string;
  startDate: string;
  durationMs: number;
  durationMinutes: number;
  calories: number | null;
  activityTypeId: number | null;
}

type FitbitLookupResponse = FitbitTokenResponse | FitbitNotConnectedResponse | FitbitErrorPayload;

function hasAccessToken(payload: FitbitLookupResponse | null): payload is FitbitTokenResponse {
  return !!payload && 'access_token' in payload && typeof payload.access_token === 'string';
}

function isNotConnected(payload: FitbitLookupResponse | null): payload is FitbitNotConnectedResponse {
  return !!payload && 'connected' in payload && payload.connected === false;
}

function getIsoDateString(date: Date): string {
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(date.getTime() - tzOffsetMs);
  return localDate.toISOString().split('T')[0];
}

function normalizeStartTime(startTime: string | undefined, fallbackDate: string): string {
  if (!startTime) {
    return `${fallbackDate}T00:00:00`;
  }

  if (startTime.includes('T')) {
    return startTime;
  }

  return `${fallbackDate}T${startTime}`;
}

export async function getValidFitbitToken(userId: string) {
  void userId;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return null;
    }

    const { data: newData, error: refreshError } = await supabase.functions.invoke<FitbitLookupResponse>('exchange-fitbit-token', {
      body: {
        grant_type: 'get_access_token',
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (refreshError) {
      console.warn('Fitbit Token Lookup nicht erfolgreich (Edge Function non-2xx).');
      return null;
    }

    if (isNotConnected(newData ?? null)) {
      return null;
    }

    if (!hasAccessToken(newData)) {
      console.error('Fitbit Token Fehler Antwort:', newData);
      return null; 
    }

    return newData.access_token;
  } catch (err) {
    console.error("Refresh Fehler:", err);
  }
  return null;
}

export async function fetchFitbitWellnessData(userId: string) {
  const token = await getValidFitbitToken(userId);
  if (!token) return null;

  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. HRV abrufen (Fitbit liefert RMSSD)
    const hrvRes = await fetch(`https://api.fitbit.com/1/user/-/hrv/date/${today}.json`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const hrvData = await hrvRes.json();

    // 2. Schlaf abrufen
    const sleepRes = await fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${today}.json`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const sleepData = await sleepRes.json();

    // Daten extrahieren (Fitbit Pfade sind etwas tief verschachtelt)
    const dailyHrv = hrvData?.hrv?.[0]?.value?.dailyRmssd || null;
    const sleepMinutes = sleepData?.summary?.totalMinutesAsleep || 0;
    const sleepHours = sleepMinutes > 0 ? (sleepMinutes / 60).toFixed(1) : null;

    return {
      hrv: dailyHrv,
      sleepHours: sleepHours ? parseFloat(sleepHours) : null,
      restingHr: sleepData?.summary?.restingHeartRate || null // Optional falls verfügbar
    };
  } catch (error) {
    console.error("Fitbit Fetch Error:", error);
    return null;
  }
}

export async function fetchFitbitWorkouts(
  userId: string
): Promise<FitbitWorkout[]> {
  const token = await getValidFitbitToken(userId);
  if (!token) return [];

  const now = new Date();
  const todayStr = getIsoDateString(now);

  try {
    const response = await fetch(`https://api.fitbit.com/1/user/-/activities/date/${todayStr}.json`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.warn('Fitbit Workout Fetch nicht erfolgreich:', response.status);
      return [];
    }

    const payload = (await response.json()) as FitbitActivityListResponse;
    const activities = Array.isArray(payload.activities) ? payload.activities : [];

    const workouts = activities
      .filter((activity) => activity.logType !== 'manual')
      .map((activity) => {
        const startDateFallback = todayStr;
        const normalizedStartTime = normalizeStartTime(activity.startTime, startDateFallback);
        const startDate = normalizedStartTime.split('T')[0] || startDateFallback;
        const durationMs = typeof activity.duration === 'number' ? activity.duration : 0;

        return {
          fitbitLogId: String(activity.logId ?? ''),
          activityName: activity.activityName?.trim() || 'Workout',
          startTime: normalizedStartTime,
          startDate,
          durationMs,
          durationMinutes: Math.max(1, Math.round((durationMs / 60000) * 10) / 10),
          calories: typeof activity.calories === 'number' ? activity.calories : null,
          activityTypeId: typeof activity.activityTypeId === 'number' ? activity.activityTypeId : null,
        } as FitbitWorkout;
      })
      .filter((activity) => !!activity.fitbitLogId && activity.startDate === todayStr)
      .sort((a, b) => (a.startTime < b.startTime ? 1 : -1));

    return workouts;
  } catch (error) {
    console.error('Fitbit Workout Fetch Error:', error);
    return [];
  }
}