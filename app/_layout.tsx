// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // Pfad anpassen
import { Session } from '@supabase/supabase-js';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments(); // Hilft uns zu wissen, wo der User gerade ist

  useEffect(() => {
    // 1. Aktuelle Session beim Start prüfen
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    // 2. Auf Änderungen am Auth-Status hören (Login/Logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

    // Logik: Ist der User im "auth" Ordner?
    const inAuthGroup = segments[0] === 'auth';

    if (session && inAuthGroup) {
      // Wenn eingeloggt und im Login-Bereich -> ab zu den Tabs
      router.replace('/tabs');
    } else if (!session && !inAuthGroup) {
      // Wenn nicht eingeloggt und nicht im Login-Bereich -> ab zum Login
      router.replace('/auth/login');
    }
  }, [session, initialized, segments]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth" />
      <Stack.Screen name="tabs" />
      <Stack.Screen 
        name="profile" 
        options={{ 
          headerShown: true, 
          presentation: 'modal', // Macht den Screen auf iOS zum Slide-up Modal
          title: 'Mein Profil' 
        }} 
      />
      <Stack.Screen name="wellness_modal" options={{ presentation: 'modal', title: 'Wellness Log' }} />
    </Stack>
  );
}