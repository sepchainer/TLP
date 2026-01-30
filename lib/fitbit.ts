import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

// Fitbit Konfiguration
const discovery = {
  authorizationEndpoint: 'https://www.fitbit.com/oauth2/authorize',
  tokenEndpoint: 'https://api.fitbit.com/oauth2/token',
};

const clientId = process.env.EXPO_PUBLIC_FITBIT_CLIENT_ID!;

export function useFitbitAuth() {
  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: clientId,
      scopes: ['heartrate', 'sleep', 'activity', 'profile'],
      redirectUri: makeRedirectUri({
        scheme: 'tlp-app', // Muss mit deinem scheme in app.json übereinstimmen!
        path: 'expo-auth-session'
      }),
      usePKCE: true,
    },
    discovery
  );

  return { request, response, promptAsync };
}