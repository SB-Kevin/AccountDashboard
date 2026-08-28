const AUTH_BASE = "https://www.threads.net/oauth/authorize";
const API_BASE = "https://graph.threads.net";
const API_VERSION = "v1.0";

const SCOPES = [
  "threads_basic",
  "threads_content_publish",
  "threads_manage_insights",
  "threads_manage_replies",
  "threads_read_replies",
].join(",");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function getThreadsAuthorizationUrl(state: string): string {
  const url = new URL(AUTH_BASE);
  url.searchParams.set("client_id", requireEnv("THREADS_APP_ID"));
  url.searchParams.set("redirect_uri", requireEnv("THREADS_REDIRECT_URI"));
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

async function parseJsonOrThrow(res: Response, context: string) {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body?.error_message || body?.error?.message || res.statusText;
    throw new Error(`${context} failed (${res.status}): ${message}`);
  }
  return body;
}

export async function exchangeCodeForShortLivedToken(code: string): Promise<{
  accessToken: string;
  threadsUserId: string;
}> {
  const form = new URLSearchParams({
    client_id: requireEnv("THREADS_APP_ID"),
    client_secret: requireEnv("THREADS_APP_SECRET"),
    grant_type: "authorization_code",
    redirect_uri: requireEnv("THREADS_REDIRECT_URI"),
    code,
  });

  const res = await fetch(`${API_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const body = await parseJsonOrThrow(res, "Short-lived token exchange");
  return { accessToken: body.access_token, threadsUserId: String(body.user_id) };
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const url = new URL(`${API_BASE}/access_token`);
  url.searchParams.set("grant_type", "th_exchange_token");
  url.searchParams.set("client_secret", requireEnv("THREADS_APP_SECRET"));
  url.searchParams.set("access_token", shortLivedToken);

  const res = await fetch(url.toString());
  const body = await parseJsonOrThrow(res, "Long-lived token exchange");
  return { accessToken: body.access_token, expiresIn: body.expires_in };
}

export async function refreshLongLivedToken(accessToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const url = new URL(`${API_BASE}/refresh_access_token`);
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const body = await parseJsonOrThrow(res, "Token refresh");
  return { accessToken: body.access_token, expiresIn: body.expires_in };
}

export async function getThreadsProfile(accessToken: string): Promise<{
  id: string;
  username: string;
  profilePictureUrl?: string;
}> {
  const url = new URL(`${API_BASE}/${API_VERSION}/me`);
  url.searchParams.set("fields", "id,username,threads_profile_picture_url");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const body = await parseJsonOrThrow(res, "Fetch profile");
  return {
    id: String(body.id),
    username: body.username,
    profilePictureUrl: body.threads_profile_picture_url,
  };
}

export async function createTextContainer(
  threadsUserId: string,
  accessToken: string,
  text: string
): Promise<string> {
  const url = new URL(`${API_BASE}/${API_VERSION}/${threadsUserId}/threads`);
  url.searchParams.set("media_type", "TEXT");
  url.searchParams.set("text", text);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { method: "POST" });
  const body = await parseJsonOrThrow(res, "Create media container");
  return String(body.id);
}

export async function publishContainer(
  threadsUserId: string,
  accessToken: string,
  creationId: string
): Promise<string> {
  const url = new URL(`${API_BASE}/${API_VERSION}/${threadsUserId}/threads_publish`);
  url.searchParams.set("creation_id", creationId);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { method: "POST" });
  const body = await parseJsonOrThrow(res, "Publish container");
  return String(body.id);
}

export async function publishTextPost(
  threadsUserId: string,
  accessToken: string,
  text: string
): Promise<string> {
  const creationId = await createTextContainer(threadsUserId, accessToken, text);
  return publishContainer(threadsUserId, accessToken, creationId);
}

const INSIGHTS_METRICS = ["views", "likes", "replies", "reposts", "quotes", "followers_count"];

export async function getThreadsInsights(
  threadsUserId: string,
  accessToken: string
): Promise<Record<string, number>> {
  const url = new URL(`${API_BASE}/${API_VERSION}/${threadsUserId}/threads_insights`);
  url.searchParams.set("metric", INSIGHTS_METRICS.join(","));
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const body = await parseJsonOrThrow(res, "Fetch insights");

  const result: Record<string, number> = {};
  for (const entry of body.data ?? []) {
    const values = entry.total_value?.value ?? entry.values?.at(-1)?.value ?? 0;
    result[entry.name] = typeof values === "number" ? values : 0;
  }
  return result;
}
