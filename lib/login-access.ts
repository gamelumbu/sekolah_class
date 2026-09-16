import { readFileSync } from "fs";
import { join } from "path";

const DEFAULT_ALLOWED_USERS_CSV = "teachers-existing.csv";

type AllowedLoginData = {
  exact: Set<string>;
  localParts: Set<string>;
};

let cachedAllowedLoginData: AllowedLoginData | null = null;

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function loadAllowedLoginData() {
  const filePath = join(process.cwd(), process.env.SSO_ALLOWED_USERS_CSV || DEFAULT_ALLOWED_USERS_CSV);
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0] || "").map((header) => normalizeIdentifier(header));
  const emailIndex = headers.findIndex((header) => ["email", "mail", "user_email"].includes(header));
  const usernameIndex = headers.findIndex((header) => ["username", "user", "login"].includes(header));
  const nikIndex = headers.indexOf("nik");

  const exact = new Set<string>();
  const localParts = new Set<string>();

  for (const line of lines.slice(1)) {
    const row = parseCsvLine(line);
    for (const index of [emailIndex, usernameIndex]) {
      if (index < 0) continue;
      const value = normalizeIdentifier(row[index] || "");
      if (!value) continue;
      exact.add(value);
      if (value.includes("@")) localParts.add(value.split("@")[0]);
    }

    if (nikIndex >= 0) {
      const nik = normalizeIdentifier(row[nikIndex] || "");
      if (nik) localParts.add(nik);
    }
  }

  return { exact, localParts };
}

export function isAllowedSsoUser(identifier: string) {
  if (!cachedAllowedLoginData) cachedAllowedLoginData = loadAllowedLoginData();
  const normalized = normalizeIdentifier(identifier);
  const localPart = normalized.split("@")[0];
  return cachedAllowedLoginData.exact.has(normalized) || cachedAllowedLoginData.localParts.has(localPart);
}
