// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; 
import { Session } from '@supabase/supabase-js';
import { ActivityIndicator, View } from 'react-native';
// 1. TanStack Query Imports
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkoutTypeProvider } from '../lib/WorkoutTypeContext';

// 2. Query Client instanziieren (außerhalb der Komponente)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Optional: Verhindert, dass die App beim App-Start im Hintergrund 
      // sofort alles neu lädt, wenn die Daten noch als "frisch" gelten.
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === 'auth';

    if (session && inAuthGroup) {
      router.replace('/tabs');
    } else if (!session && !inAuthGroup) {
      router.replace('/auth/login');
    }
  }, [session, initialized, segments]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#0f0f0f' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // 3. Den Stack mit dem QueryClientProvider umschließen
  return (
    <QueryClientProvider client={queryClient}>
      <WorkoutTypeProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f0f0f' } }}>
          <Stack.Screen name="auth" />
          <Stack.Screen name="tabs" />
          <Stack.Screen 
            name="profile" 
            options={{ 
              headerShown: true, 
              presentation: 'modal', 
              title: 'Mein Profil',
              headerStyle: { backgroundColor: '#1a1a1a' },
              headerTintColor: '#ffffff',
              headerTitleStyle: { color: '#ffffff', fontWeight: 'bold' }
            }} 
          />
          <Stack.Screen name="wellness_modal" options={{ 
            presentation: 'modal', 
            title: 'Wellness Log',
            headerStyle: { backgroundColor: '#1a1a1a' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { color: '#ffffff', fontWeight: 'bold' }
          }} />
          <Stack.Screen name="training_modal" options={{ 
            presentation: 'modal', 
            title: 'Training Log',
            headerStyle: { backgroundColor: '#1a1a1a' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { color: '#ffffff', fontWeight: 'bold' }
          }} />
          <Stack.Screen 
            name="workout_type_selector" 
            options={{ 
              presentation: 'modal', 
              title: 'Trainingstypen',
              headerStyle: { backgroundColor: '#1a1a1a' },
              headerTintColor: '#ffffff',
              headerTitleStyle: { color: '#ffffff', fontWeight: 'bold' }
            }} 
          />
        </Stack>
      </WorkoutTypeProvider>
    </QueryClientProvider>
  );
}