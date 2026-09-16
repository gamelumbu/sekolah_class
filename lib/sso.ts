type SsoConfig = {
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl?: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  allowedDomains: string[];
};

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type UserInfo = {
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  upn?: string;
  unique_name?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} belum dikonfigurasi.`);
  return value;
}

function optionalEnv(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function getSsoConfig(): SsoConfig {
  return {
    authorizationUrl: requiredEnv("SSO_AUTHORIZATION_URL"),
    tokenUrl: requiredEnv("SSO_TOKEN_URL"),
    userinfoUrl: optionalEnv("SSO_USERINFO_URL"),
    clientId: requiredEnv("SSO_CLIENT_ID"),
    clientSecret: requiredEnv("SSO_CLIENT_SECRET"),
    scope: process.env.SSO_SCOPE || "openid email profile",
    allowedDomains: (process.env.SSO_ALLOWED_DOMAINS || "")
      .split(",")
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean),
  };
}

export function isSsoConfigured() {
  return Boolean(
    process.env.SSO_AUTHORIZATION_URL &&
      process.env.SSO_TOKEN_URL &&
      process.env.SSO_CLIENT_ID &&
      process.env.SSO_CLIENT_SECRET,
  );
}

export function createRandomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

export function getSsoRedirectUri(request: Request) {
  return `${getBaseUrl(request)}/api/auth/sso/callback`;
}

export function buildAuthorizationUrl(config: SsoConfig, request: Request, state: string) {
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", getSsoRedirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeCodeForToken(config: SsoConfig, request: Request, code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getSsoRedirectUri(request),
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });

  const token = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || token.error || !token.access_token) {
    throw new Error(token.error_description || token.error || "Gagal menukar kode SSO.");
  }

  return token;
}

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))) as UserInfo;
  } catch {
    return null;
  }
}

export async function getSsoUser(config: SsoConfig, token: TokenResponse) {
  let user: UserInfo | null = null;

  if (config.userinfoUrl) {
    const response = await fetch(config.userinfoUrl, {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
    });
    if (response.ok) user = (await response.json()) as UserInfo;
  }

  if (!user && token.id_token) user = decodeJwtPayload(token.id_token);
  const username = user?.email || user?.preferred_username || user?.upn || user?.unique_name || user?.name || user?.sub;
  if (!username) throw new Error("Profil SSO tidak memiliki identitas pengguna.");

  const email = user?.email || (username.includes("@") ? username : "");
  if (config.allowedDomains.length > 0) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain || !config.allowedDomains.includes(domain)) throw new Error("Akun SSO tidak diizinkan mengakses dashboard ini.");
  }

  return username;
}
