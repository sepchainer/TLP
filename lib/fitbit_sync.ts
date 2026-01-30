// libs/fitbit_sync.ts
import { supabase } from './supabase';
import { Buffer } from 'buffer';

export async function getValidFitbitToken(userId: string) {
  // 1. Token aus Supabase holen
  const { data: tokenData, error } = await supabase
    .from('fitbit_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) return null;

  // 2. Prüfen, ob der Token abgelaufen ist (mit 5 Min Puffer)
  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);
  
  if (now < new Date(expiresAt.getTime() - 5 * 60000)) {
    return tokenData.access_token; // Token noch gültig
  }

  // 3. Wenn abgelaufen: Refresh-Prozess starten
  console.log("Fitbit Token abgelaufen. Erneuere...");
  
  const credentials = Buffer.from(
    `${process.env.EXPO_PUBLIC_FITBIT_CLIENT_ID}:${process.env.EXPO_PUBLIC_FITBIT_CLIENT_SECRET}`
  ).toString('base64');

  try {
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenData.refresh_token,
      }).toString(),
    });

    const newData = await response.json();

    if (newData.access_token) {
      // 4. Neue Tokens in Supabase speichern
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + newData.expires_in);

      await supabase.from('fitbit_tokens').update({
        access_token: newData.access_token,
        refresh_token: newData.refresh_token,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString()
      }).eq('user_id', userId);

      return newData.access_token;
    }
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