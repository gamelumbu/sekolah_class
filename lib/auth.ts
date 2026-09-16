const SESSION_COOKIE = "dashboard_session";
const SSO_STATE_COOKIE = "dashboard_sso_state";
const SESSION_MAX_AGE = 60 * 60 * 8;
const SSO_STATE_MAX_AGE = 60 * 10;

type SessionPayload = {
  username: string;
  expiresAt: number;
};

function encode(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
}

function safeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return mismatch === 0;
}

async function signature(payload: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET harus memiliki minimal 32 karakter.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return encode(String.fromCharCode(...new Uint8Array(signed)));
}

export async function createSession(username: string) {
  const payload: SessionPayload = { username, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${await signature(encodedPayload)}`;
}

export async function verifySession(token?: string) {
  if (!token) return null;
  const [payload, receivedSignature] = token.split(".");
  if (!payload || !receivedSignature) return null;
  try {
    const expectedSignature = await signature(payload);
    if (!safeEqual(receivedSignature, expectedSignature)) return null;
    const session = JSON.parse(decode(payload)) as SessionPayload;
    if (!session.username || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function validateCredentials(username: string, password: string) {
  const configuredUsername = process.env.DASHBOARD_USERNAME;
  const configuredPassword = process.env.DASHBOARD_PASSWORD;
  if (!configuredUsername || !configuredPassword) return false;
  return safeEqual(username, configuredUsername) && safeEqual(password, configuredPassword);
}

export const authCookie = {
  name: SESSION_COOKIE,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  },
};

export const ssoStateCookie = {
  name: SSO_STATE_COOKIE,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SSO_STATE_MAX_AGE,
  },
};
