import React, { useEffect } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { Buffer } from 'buffer';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://www.fitbit.com/oauth2/authorize',
  tokenEndpoint: 'https://api.fitbit.com/oauth2/token',
};

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
    const credentials = Buffer.from(
      `${process.env.EXPO_PUBLIC_FITBIT_CLIENT_ID}:${process.env.EXPO_PUBLIC_FITBIT_CLIENT_SECRET}`
    ).toString('base64');

    try {
      const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: makeRedirectUri({ scheme: 'tlp-app', path: 'expo-auth-session' }),
          code_verifier: codeVerifier!,
        }).toString(),
      });
      console.log(makeRedirectUri({ scheme: 'tlp-app', path: 'expo-auth-session' }));

      const data = await tokenResponse.json();
      
      if (data.access_token) {
        await saveTokensToSupabase(data);
      }
    } catch (error) {
      console.error("Token Exchange Error:", error);
    }
  }

  async function saveTokensToSupabase(data: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);

    const { error } = await supabase.from('fitbit_tokens').upsert({
      user_id: user.id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      Alert.alert("Fehler beim Speichern", error.message);
    } else {
      Alert.alert("Erfolg", "Fitbit ist jetzt verbunden!");
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
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  section: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 20, elevation: 2 },
  subtitle: { fontSize: 18, fontWeight: '600', marginBottom: 15 },
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