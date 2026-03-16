import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type FitbitGrantType = "authorization_code" | "refresh_token" | "get_access_token";

interface AuthorizationCodeRequest {
	grant_type: "authorization_code";
	code: string;
	redirect_uri: string;
	code_verifier?: string;
}

interface RefreshTokenRequest {
	grant_type: "refresh_token";
	refresh_token: string;
}

interface GetAccessTokenRequest {
	grant_type: "get_access_token";
}

type ExchangeRequest = AuthorizationCodeRequest | RefreshTokenRequest | GetAccessTokenRequest;

interface RawExchangeRequest {
	grant_type: FitbitGrantType;
	code?: string;
	refresh_token?: string;
	redirect_uri?: string;
	code_verifier?: string;
}

interface FitbitTokenApiResponse {
	access_token?: string;
	refresh_token?: string;
	expires_in?: number;
	errors?: Array<{ message?: string; errorType?: string }>;
	error?: string;
}

interface StoredFitbitToken {
	access_token: string;
	refresh_token: string;
	expires_at: string;
}

interface GetAccessTokenDisconnectedResponse {
	connected: false;
	token_refreshed: false;
	reason: "not_connected" | "reauthorization_required";
}

function extractUserIdFromJwt(jwt: string): string | null {
	try {
		const parts = jwt.split(".");
		if (parts.length < 2) {
			return null;
		}

		const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
		const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
		const payloadJson = atob(padded);
		const payload = JSON.parse(payloadJson) as { sub?: string; role?: string };

		if (payload.role !== "authenticated" || !payload.sub) {
			return null;
		}

		return payload.sub;
	} catch {
		return null;
	}
}

function isLikelyReauthNeeded(data: FitbitTokenApiResponse): boolean {
	if (typeof data.error === "string") {
		const err = data.error.toLowerCase();
		if (err.includes("invalid_grant") || err.includes("invalid_token") || err.includes("expired") || err.includes("revoked")) {
			return true;
		}
	}

	if (Array.isArray(data.errors)) {
		return data.errors.some((entry) => {
			const message = entry?.message?.toLowerCase() ?? "";
			const type = entry?.errorType?.toLowerCase() ?? "";
			return (
				type.includes("invalid_grant") ||
				type.includes("invalid_token") ||
				type.includes("expired") ||
				type.includes("revoked") ||
				message.includes("invalid_grant") ||
				message.includes("invalid token") ||
				message.includes("expired") ||
				message.includes("revoked")
			);
		});
	}

	return false;
}

function parseExchangeRequest(body: RawExchangeRequest): ExchangeRequest | null {
	if (body.grant_type === "authorization_code" && body.code && body.redirect_uri) {
		return {
			grant_type: "authorization_code",
			code: body.code,
			redirect_uri: body.redirect_uri,
			code_verifier: body.code_verifier,
		};
	}

	if (body.grant_type === "refresh_token" && body.refresh_token) {
		return {
			grant_type: "refresh_token",
			refresh_token: body.refresh_token,
		};
	}

	if (body.grant_type === "get_access_token") {
		return {
			grant_type: "get_access_token",
		};
	}

	return null;
}

serve(async (req: Request) => {
	try {
		if (req.method !== "POST") {
			return new Response(JSON.stringify({ error: "Method not allowed" }), {
				status: 405,
				headers: { "Content-Type": "application/json" },
			});
		}

		const body: RawExchangeRequest = await req.json();
		const parsed = parseExchangeRequest(body);

		if (!parsed) {
			return new Response(
				JSON.stringify({ error: "Invalid request payload for grant_type" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const { grant_type } = parsed;

		if (
			grant_type !== "authorization_code" &&
			grant_type !== "refresh_token" &&
			grant_type !== "get_access_token"
		) {
			return new Response(JSON.stringify({ error: "Unsupported grant_type" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const clientId = Deno.env.get("FITBIT_CLIENT_ID");
		const clientSecret = Deno.env.get("FITBIT_CLIENT_SECRET");
		const supabaseUrl = Deno.env.get("SUPABASE_URL");
		const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

		if (!supabaseUrl || !supabaseServiceRoleKey) {
			return new Response(
				JSON.stringify({ error: "Missing Supabase server configuration" }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}

		const authHeader = req.headers.get("Authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		const jwt = authHeader.slice("Bearer ".length);
		const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
		const {
			data: { user },
			error: userError,
		} = await supabaseAdmin.auth.getUser(jwt);
		let userId = user?.id ?? null;

		if (!userId) {
			userId = extractUserIdFromJwt(jwt);
		}

		if (!userId) {
			const details = userError?.message ?? "Unable to resolve user from JWT";
			return new Response(
				JSON.stringify({ error: "Unauthorized", code: "user_lookup_failed", details }),
				{ status: 401, headers: { "Content-Type": "application/json" } },
			);
		}

		if (!clientId || !clientSecret) {
			return new Response(
				JSON.stringify({ error: "Missing server configuration" }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}

		const credentials = btoa(`${clientId}:${clientSecret}`);

		let tokenFromDb: StoredFitbitToken | null = null;
		if (parsed.grant_type === "get_access_token") {
			const { data: storedToken, error: storedTokenError } = await supabaseAdmin
				.from("fitbit_tokens")
				.select("access_token, refresh_token, expires_at")
				.eq("user_id", userId)
				.single<StoredFitbitToken>();

			if (storedTokenError || !storedToken) {
				// A missing row is expected for users that have not connected Fitbit yet.
				const notConnectedPayload: GetAccessTokenDisconnectedResponse = {
					connected: false,
					token_refreshed: false,
					reason: "not_connected",
				};
				return new Response(
					JSON.stringify(notConnectedPayload),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}

			tokenFromDb = storedToken;
			const now = Date.now();
			const expiresAt = new Date(storedToken.expires_at).getTime();
			const buffer = 5 * 60 * 1000;

			if (now < expiresAt - buffer) {
				return new Response(
					JSON.stringify({ access_token: storedToken.access_token, token_refreshed: false }),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
		}

		const params = new URLSearchParams();
		if (parsed.grant_type === "authorization_code") {
			params.set("grant_type", "authorization_code");
			params.set("code", parsed.code);
			params.set("redirect_uri", parsed.redirect_uri);
			if (parsed.code_verifier) {
				params.set("code_verifier", parsed.code_verifier);
			}
		} else if (parsed.grant_type === "refresh_token") {
			params.set("grant_type", "refresh_token");
			params.set("refresh_token", parsed.refresh_token);
		} else {
			params.set("grant_type", "refresh_token");
			params.set("refresh_token", tokenFromDb!.refresh_token);
		}

		const response = await fetch("https://api.fitbit.com/oauth2/token", {
			method: "POST",
			headers: {
				Authorization: `Basic ${credentials}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: params.toString(),
		});

		const data: FitbitTokenApiResponse = await response.json();

		if (!response.ok) {
			if (parsed.grant_type === "get_access_token" && (response.status === 400 || response.status === 401) && isLikelyReauthNeeded(data)) {
				const reconnectPayload: GetAccessTokenDisconnectedResponse = {
					connected: false,
					token_refreshed: false,
					reason: "reauthorization_required",
				};
				return new Response(JSON.stringify(reconnectPayload), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			return new Response(JSON.stringify(data), {
				status: response.status,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (!data.access_token || !data.refresh_token || !data.expires_in) {
			return new Response(
				JSON.stringify({ error: "Fitbit response missing token fields", details: data }),
				{ status: 502, headers: { "Content-Type": "application/json" } },
			);
		}

		const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
		const { error: tokenWriteError } = await supabaseAdmin
			.from("fitbit_tokens")
			.upsert({
				user_id: userId,
				access_token: data.access_token,
				refresh_token: data.refresh_token,
				expires_at: expiresAt,
				updated_at: new Date().toISOString(),
			});

		if (tokenWriteError) {
			return new Response(
				JSON.stringify({ error: "Failed to persist tokens", details: tokenWriteError.message }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}

		return new Response(JSON.stringify({ ...data, tokens_stored: true, token_refreshed: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return new Response(JSON.stringify({ error: message }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
});