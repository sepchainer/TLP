// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  // Diese Datei wird als erstes geladen.
  // Die eigentliche Logik passiert im _layout.tsx, 
  // aber wir brauchen diese Datei, damit die App weiß, wo sie starten soll.
  return <Redirect href="/auth/login" />;
}