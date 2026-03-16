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

type FitbitLookupResponse = FitbitTokenResponse | FitbitNotConnectedResponse | FitbitErrorPayload;

function hasAccessToken(payload: FitbitLookupResponse | null): payload is FitbitTokenResponse {
  return !!payload && 'access_token' in payload && typeof payload.access_token === 'string';
}

function isNotConnected(payload: FitbitLookupResponse | null): payload is FitbitNotConnectedResponse {
  return !!payload && 'connected' in payload && payload.connected === false;
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