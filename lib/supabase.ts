import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

// SecureStore hat ein Limit von 2048 Bytes pro Eintrag.
// Supabase-Sessions können größer sein, daher werden sie in Chunks aufgeteilt.
const CHUNK_SIZE = 1900; // konservativ unter dem 2048-Byte-Limit

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const chunkCount = await SecureStore.getItemAsync(`${key}_chunkCount`);
    if (chunkCount === null) {
      // Kein chunking – direkt lesen (Rückwärtskompatibilität)
      return SecureStore.getItemAsync(key);
    }
    const count = parseInt(chunkCount, 10);
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      // Eventuell vorhandene alte Chunks entfernen
      await SecureStore.deleteItemAsync(`${key}_chunkCount`);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
    }
    await SecureStore.setItemAsync(`${key}_chunkCount`, String(chunks.length));
    // Direkten Eintrag entfernen, falls er vorher ohne Chunking gespeichert wurde
    await SecureStore.deleteItemAsync(key);
  },
  removeItem: async (key: string): Promise<void> => {
    const chunkCount = await SecureStore.getItemAsync(`${key}_chunkCount`);
    if (chunkCount !== null) {
      const count = parseInt(chunkCount, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      }
      await SecureStore.deleteItemAsync(`${key}_chunkCount`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});