// libs/fitbit_sync.ts
import { supabase } from './supabase';
import { Buffer } from 'buffer';

export async function getValidFitbitToken(userId: string) {
  const { data: tokenData, error } = await supabase
    .from('fitbit_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) {
    console.error("Kein Token in DB gefunden");
    return null;
  }

  // Sicherere Zeitprüfung
  const now = Date.now();
  const expiresAt = new Date(tokenData.expires_at).getTime();
  const buffer = 5 * 60 * 1000; // 5 Minuten Puffer

  // Wenn noch gültig, direkt zurückgeben
  if (now < (expiresAt - buffer)) {
    return tokenData.access_token;
  }

  // REFRESH LOGIK
  console.log("Fitbit Token abgelaufen. Starte Refresh...");
  
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

    // WICHTIG: Prüfen ob Fitbit einen Fehler meldet (z.B. invalid_grant)
    if (newData.errors || !newData.access_token) {
      console.error("Fitbit Refresh Fehler Antwort:", newData.errors);
      return null; 
    }

    // Neue Ablaufzeit berechnen (expires_in ist in Sekunden)
    const newExpiresAt = new Date(Date.now() + newData.expires_in * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('fitbit_tokens')
      .update({
        access_token: newData.access_token,
        refresh_token: newData.refresh_token, // Wichtig: Fitbit rotiert meistens den Refresh-Token!
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error("Fehler beim Speichern in Supabase:", updateError);
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