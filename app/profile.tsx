import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
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

interface FitbitDisconnectedResponse {
  connected: false;
  token_refreshed: false;
  reason: 'not_connected' | 'reauthorization_required';
}

type FitbitLookupResponse = FitbitTokenResponse | FitbitDisconnectedResponse | EdgeFunctionErrorPayload;

export default function ProfileScreen() {
  const router = useRouter();
  const [fitbitConnected, setFitbitConnected] = useState<boolean | null>(null);
  const [fitbitDisconnectReason, setFitbitDisconnectReason] = useState<'not_connected' | 'reauthorization_required' | null>(null);
  const [isCheckingFitbit, setIsCheckingFitbit] = useState(true);

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
    checkFitbitStatus();
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      exchangeCodeForToken(code, request?.codeVerifier);
    }
  }, [response]);

  async function checkFitbitStatus() {
    setIsCheckingFitbit(true);
    try {
      const { data, error } = await supabase.functions.invoke<FitbitLookupResponse>('exchange-fitbit-token', {
        body: {
          grant_type: 'get_access_token',
        },
      });

      if (error) {
        setFitbitConnected(false);
        setFitbitDisconnectReason('not_connected');
        return;
      }

      const isConnected = !!data && 'access_token' in data && typeof data.access_token === 'string';
      setFitbitConnected(isConnected);
      if (isConnected) {
        setFitbitDisconnectReason(null);
      } else if (data && 'reason' in data && data.reason) {
        setFitbitDisconnectReason(data.reason);
      } else {
        setFitbitDisconnectReason('not_connected');
      }
    } catch (error) {
      console.error('Fitbit Status Check Error:', error);
      setFitbitConnected(false);
      setFitbitDisconnectReason('not_connected');
    } finally {
      setIsCheckingFitbit(false);
    }
  }

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
        setFitbitConnected(true);
        setFitbitDisconnectReason(null);
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

        {isCheckingFitbit ? (
          <View style={styles.statusCard}>
            <ActivityIndicator size="small" color="#00B0B9" />
            <Text style={styles.statusText}>Fitbit Status wird geprüft...</Text>
          </View>
        ) : fitbitConnected ? (
          <View style={[styles.statusCard, styles.connectedCard]}>
            <Ionicons name="checkmark-circle" size={20} color="#2e7d32" />
            <Text style={[styles.statusText, styles.connectedText]}>Fitbit verbunden</Text>
          </View>
        ) : (
          <View style={styles.disconnectedContainer}>
            {fitbitDisconnectReason === 'reauthorization_required' && (
              <Text style={styles.reconnectHint}>Fitbit Verbindung abgelaufen. Bitte neu verbinden.</Text>
            )}
            <TouchableOpacity
              style={styles.fitbitButton}
              onPress={() => promptAsync()}
              disabled={!request}
            >
              <Ionicons name="logo-foursquare" size={20} color="white" />
              <Text style={styles.buttonText}>
                {fitbitDisconnectReason === 'reauthorization_required' ? 'Fitbit neu verbinden' : 'Mit Fitbit verbinden'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  disconnectedContainer: {
    gap: 10,
  },
  reconnectHint: {
    color: '#FFB74D',
    fontSize: 13,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  connectedCard: {
    backgroundColor: '#1a3a1a',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  connectedText: {
    color: '#4CAF50',
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  footer: { marginTop: 'auto', gap: 10, paddingBottom: 20 }
});