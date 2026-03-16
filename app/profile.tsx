import React, { useEffect } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://www.fitbit.com/oauth2/authorize',
  tokenEndpoint: 'https://api.fitbit.com/oauth2/token',
};

interface FitbitTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  tokens_stored?: boolean;
}

interface EdgeFunctionErrorPayload {
  error?: string;
  errors?: Array<{ message?: string }>;
}

export default function ProfileScreen() {
  const router = useRouter();

  // --- Fitbit Auth Request ---
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_FITBIT_CLIENT_ID!,
      scopes: ['heartrate', 'sleep', 'activity', 'profile'],
      redirectUri: makeRedirectUri({
        scheme: 'tlp-app',
        path: 'expo-auth-session'
      }),
      usePKCE: true,
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      exchangeCodeForToken(code, request?.codeVerifier);
    }
  }, [response]);

  async function exchangeCodeForToken(code: string, codeVerifier: string | undefined) {
    const redirectUri = makeRedirectUri({ scheme: 'tlp-app', path: 'expo-auth-session' });

    if (!codeVerifier) {
      Alert.alert('Fitbit Verbindung fehlgeschlagen', 'Code-Verifier fehlt für PKCE.');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke<FitbitTokenResponse | EdgeFunctionErrorPayload>('exchange-fitbit-token', {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        },
      });

      if (error) {
        throw error;
      }

      if (data && 'access_token' in data && data.access_token) {
        Alert.alert('Erfolg', 'Fitbit ist jetzt verbunden!');
      } else {
        const message = data && 'error' in data && data.error
          ? data.error
          : 'Kein access_token von der Edge Function erhalten';
        throw new Error(message);
      }
    } catch (error) {
      console.error("Token Exchange Error:", error);
      Alert.alert('Fitbit Verbindung fehlgeschlagen', 'Token konnte nicht ausgetauscht werden.');
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dein Profil</Text>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Verbindungen</Text>
        <TouchableOpacity 
          style={styles.fitbitButton} 
          onPress={() => promptAsync()}
          disabled={!request}
        >
          <Ionicons name="logo-foursquare" size={20} color="white" />
          <Text style={styles.buttonText}>Mit Fitbit verbinden</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Button title="Abmelden" color="red" onPress={handleLogout} />
        <Button title="Schließen" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 20, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#ffffff' },
  section: { backgroundColor: '#2a2a2a', padding: 20, borderRadius: 15, marginBottom: 20, elevation: 2 },
  subtitle: { fontSize: 18, fontWeight: '600', marginBottom: 15, color: '#ffffff' },
  fitbitButton: { 
    backgroundColor: '#00B0B9', 
    padding: 15, 
    borderRadius: 12, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 10 
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  footer: { marginTop: 'auto', gap: 10, paddingBottom: 20 }
});