import { neon } from "@neondatabase/serverless";

export type LoginUser = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type LoginUserRow = {
  id: number | string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }

  return neon(databaseUrl);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getConfiguredMasterUsers() {
  return (process.env.SSO_MASTER_USERS || process.env.SSO_MASTER_EMAILS || "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

export function isConfiguredMasterUser(identifier: string) {
  const normalized = normalizeEmail(identifier);
  const localPart = normalized.split("@")[0];

  return getConfiguredMasterUsers().some(
    (user) => user === normalized || user === localPart,
  );
}

export async function ensureLoginUsersTable() {
  return getSql();
}

function mapUser(row: LoginUserRow): LoginUser {
  return {
    id: Number(row.id),
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    active: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function authenticateLoginUser(
  username: string,
  password: string,
): Promise<LoginUser | null> {
  const sql = getSql();

  const rows = (await sql`
    SELECT
      id,
      username,
      email,
      full_name,
      role,
      is_active,
      created_at,
      updated_at
    FROM dashboard_users
    WHERE username = ${username.trim()}
      AND is_active = TRUE
      AND password_hash = crypt(${password}, password_hash)
    LIMIT 1
  `) as LoginUserRow[];

  if (!rows[0]) {
    return null;
  }

  return mapUser(rows[0]);
}

export async function listLoginUsers(): Promise<LoginUser[]> {
  const sql = await ensureLoginUsersTable();

  const rows = (await sql`
    SELECT
      id,
      username,
      email,
      full_name,
      role,
      is_active,
      created_at,
      updated_at
    FROM dashboard_users
    ORDER BY is_active DESC, username ASC
  `) as LoginUserRow[];

  return rows.map(mapUser);
}

export async function upsertLoginUser(input: {
  username: string;
  email: string;
  fullName?: string;
  role?: string;
  active?: boolean;
}) {
  const sql = await ensureLoginUsersTable();

  const username = input.username.trim();
  const email = normalizeEmail(input.email);
  const fullName = input.fullName?.trim() || "";
  const role = input.role === "admin" ? "ADMIN" : "USER";
  const isActive = input.active ?? true;

  if (!username) {
    throw new Error("Username wajib diisi.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Format email tidak valid.");
  }

  const rows = (await sql`
    INSERT INTO dashboard_users (
      username,
      email,
      full_name,
      role,
      is_active
    )
    VALUES (
      ${username},
      ${email},
      ${fullName},
      ${role},
      ${isActive}
    )
    ON CONFLICT (email) DO UPDATE SET
      username = EXCLUDED.username,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING
      id,
      username,
      email,
      full_name,
      role,
      is_active,
      created_at,
      updated_at
  `) as LoginUserRow[];

  return mapUser(rows[0]);
}

export async function setLoginUserActive(
  id: number,
  active: boolean,
): Promise<LoginUser> {
  const sql = await ensureLoginUsersTable();

  const rows = (await sql`
    UPDATE dashboard_users
    SET
      is_active = ${active},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING
      id,
      username,
      email,
      full_name,
      role,
      is_active,
      created_at,
      updated_at
  `) as LoginUserRow[];

  if (!rows[0]) {
    throw new Error("User tidak ditemukan.");
  }

  return mapUser(rows[0]);
}

export async function deleteLoginUser(id: number) {
  const sql = await ensureLoginUsersTable();

  await sql`
    DELETE FROM dashboard_users
    WHERE id = ${id}
  `;
}

export async function isActiveLoginUser(identifier: string) {
  if (!process.env.DATABASE_URL) return false;

  const sql = getSql();
  const normalized = identifier.trim().toLowerCase();

  const rows = (await sql`
    SELECT is_active
    FROM dashboard_users
    WHERE LOWER(username) = ${normalized}
       OR LOWER(email) = ${normalized}
    LIMIT 1
  `) as { is_active: boolean }[];

  return rows[0]?.is_active === true;
}

export async function isActiveLoginAdmin(identifier: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    return false;
  }

  const sql = getSql();
  const username = identifier.trim();

  const rows = (await sql`
    SELECT is_active
    FROM dashboard_users
    WHERE username = ${username}
      AND role = 'ADMIN'
    LIMIT 1
  `) as { is_active: boolean }[];

  return rows[0]?.is_active === true;
}
