import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface ExchangeRequest {
  code: string;
  redirect_uri: string;
}

serve(async (req: Request) => {
  try {
    const { code, redirect_uri }: ExchangeRequest = await req.json();

    const clientId = Deno.env.get('FITBIT_CLIENT_ID');
    const clientSecret = Deno.env.get('FITBIT_CLIENT_SECRET');

    // Validierung: Wenn Variablen fehlen, wirf einen Fehler
    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Missing Server Configuration" }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);

    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri,
      }),
    });

    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
})