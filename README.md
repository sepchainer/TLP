# TLP – Training Load Planner

Expo React Native App mit Supabase Backend und Fitbit-Integration.

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| App | Expo ~54, React Native 0.81, Expo Router |
| Backend | Supabase (Datenbank + Auth + Edge Functions) |
| Wearable | Fitbit API (OAuth 2.0 mit PKCE) |
| State | TanStack Query v5 |
| Build | EAS Build |

---

## Lokale Entwicklung

### Voraussetzungen

- Node.js + npm
- Expo CLI (`npm install -g expo-cli`)
- Supabase CLI (`npm install -g supabase`)
- EAS CLI (`npm install -g eas-cli`)

### Setup

```bash
git clone <repo-url>
cd TLP
npm install
```

### Umgebungsvariablen

`.env` im Projektstamm anlegen (wird nicht ins Git eingecheckt):

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_FITBIT_CLIENT_ID=<fitbit-client-id>
```

> **Wichtig:** `FITBIT_CLIENT_SECRET` gehört **nicht** in die `.env` der App.
> Das Secret wird ausschließlich als Supabase Server-Secret hinterlegt (siehe unten).

### App starten

```bash
npx expo start          # Expo Go / Development Build
npx expo start -c       # Mit Cache-Reset (bei komischen Fehlern)
npx expo start --android
npx expo start --ios
```

---

## Supabase Edge Functions

### Funktion: `exchange-fitbit-token`

Verarbeitet den gesamten Fitbit OAuth-Flow serverseitig:

| `grant_type` | Aktion |
|---|---|
| `authorization_code` | Tauscht OAuth-Code gegen Access-/Refresh-Token und speichert in DB |
| `refresh_token` | Erneuert einen Token direkt per Refresh-Token |
| `get_access_token` | Holt gespeicherten Token aus DB, refresht bei Bedarf automatisch |

**Responses `get_access_token`:**
- Token gültig → `{ access_token: "...", token_refreshed: false }`
- Token abgelaufen → neuer Token wird geholt, gespeichert und zurückgegeben
- Kein Token in DB → `{ connected: false, reason: "not_connected" }` (HTTP 200)
- Fitbit-Token widerrufen → `{ connected: false, reason: "reauthorization_required" }` (HTTP 200)

### Deployment

```bash
npx supabase functions deploy exchange-fitbit-token --no-verify-jwt
```

> **`--no-verify-jwt` ist Pflicht!**
>
> Dieses Supabase-Projekt verwendet **ES256**-signierte JWTs (neuer Standard).
> Der Supabase-Gateway-JWT-Verifier unterstützt nur HS256 und würde jeden Request
> mit `401` ablehnen, bevor die Funktion überhaupt ausgeführt wird.
>
> Die Authentifizierung wird stattdessen intern via `supabaseAdmin.auth.getUser(jwt)`
> durchgeführt – das ist sicherer, da es auch revozierte Sessions erkennt.

### Supabase Server-Secrets setzen

Die folgenden Secrets müssen im Supabase-Projekt hinterlegt sein:

```bash
npx supabase secrets set FITBIT_CLIENT_ID=<client-id>
npx supabase secrets set FITBIT_CLIENT_SECRET=<client-secret>
```

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` und `SUPABASE_DB_URL`
werden von Supabase automatisch gesetzt.

Secrets auflisten:

```bash
npx supabase secrets list
```

---

## Datenbank-Schema (relevante Tabellen)

### `fitbit_tokens`

| Spalte | Typ | Beschreibung |
|---|---|---|
| `user_id` | uuid (FK → auth.users) | Supabase User |
| `access_token` | text | Fitbit Access Token |
| `refresh_token` | text | Fitbit Refresh Token |
| `expires_at` | timestamptz | Ablaufzeit des Access Tokens |
| `updated_at` | timestamptz | Letztes Update |

---

## Fitbit OAuth-Flow

1. User tippt „Mit Fitbit verbinden" in `app/profile.tsx`
2. App öffnet Fitbit-Autorisierungsseite via `expo-auth-session` (PKCE)
3. Redirect zurück zur App mit `code`
4. App ruft Edge Function mit `grant_type: "authorization_code"` auf
5. Edge Function tauscht Code gegen Token bei Fitbit und speichert in `fitbit_tokens`

**Beim App-Start / Dashboard-Load:**

- `lib/fitbit_sync.ts` → `getValidFitbitToken()` ruft Edge Function mit `grant_type: "get_access_token"` auf
- Token gültig → direkt zurück
- Token abgelaufen → Edge Function refresht automatisch
- Nicht verbunden / widerrufen → `null` zurück, App zeigt „Sync ausstehend"

---

## EAS Build

```bash
# Development Build (für physisches Gerät)
eas build --profile development --platform android

# Preview APK
eas build --profile preview --platform android

# Production
eas build --profile production --platform android
```

EAS Project ID: `e19004db-2843-4c27-b7f7-ed6ce28fbd30`

---

## Supabase Projekt

- **Project Ref:** `ftzvbycyquullvgpegmz`
- **Region:** `eu-central-1`
- **Dashboard:** https://supabase.com/dashboard/project/ftzvbycyquullvgpegmz
