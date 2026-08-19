import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { Teacher } from "@/app/dashboard-client";

const EXPECTED_TOTAL = 2230;
const EXPECTED_NON_KASEK_CATEGORIES: Record<string, number> = {
  "Guru Nasional": 1867,
  "Guru Bilingual": 123,
  "Guru Internasional": 170,
};
const VALID_LEVELS = new Set(["TK", "SD", "SMP", "SLTA", "Internasional"]);
const VALID_GROUP_LEVELS = new Set(["TK", "SD", "SMP", "SLTA", "Primary", "Secondary"]);

let cachedTeachers: Teacher[] | undefined;

function text(value: unknown, field: string, nik: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`Database guru tidak valid: ${field} kosong untuk NIK ${nik}.`);
  return normalized;
}

function number(value: unknown, field: string, nik: string) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error(`Database guru tidak valid: ${field} untuk NIK ${nik}.`);
  }
  return normalized;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
}

function normalizeTeacher(value: unknown): Teacher {
  if (!value || typeof value !== "object") throw new Error("Database guru memuat baris yang tidak valid.");
  const source = value as Record<string, unknown>;
  const nik = text(source.nik, "NIK", "tidak diketahui").padStart(7, "0");
  const jenjang = text(source.jenjang, "Jenjang", nik);
  const groupJenjang = text(source.groupJenjang, "Grup Jenjang", nik);
  const jtm = number(source.jtm, "JTM", nik);
  const taskHours = number(source.taskHours, "Jam Tugas", nik);
  const actual = number(source.actual, "Jam Aktual", nik);
  const tasks = stringList(source.tasks);
  const locations = stringList(source.locations);
  const threshold = jenjang === "Internasional" ? 30 : 24;

  if (!VALID_LEVELS.has(jenjang)) throw new Error(`Database guru tidak valid: Jenjang ${jenjang} untuk NIK ${nik}.`);
  if (!VALID_GROUP_LEVELS.has(groupJenjang)) throw new Error(`Database guru tidak valid: Grup Jenjang ${groupJenjang} untuk NIK ${nik}.`);
  if (jenjang === "Internasional" && !["Primary", "Secondary"].includes(groupJenjang)) {
    throw new Error(`Database guru tidak valid: Grup Jenjang Internasional untuk NIK ${nik}.`);
  }
  if (jenjang !== "Internasional" && groupJenjang !== jenjang) {
    throw new Error(`Database guru tidak valid: Jenjang dan Grup Jenjang tidak selaras untuk NIK ${nik}.`);
  }
  if (actual !== jtm + taskHours) {
    throw new Error(`Database guru tidak valid: Jam Aktual tidak sama dengan JTM + Jam Tugas untuk NIK ${nik}.`);
  }

  return {
    nik,
    name: text(source.name, "Nama", nik),
    gender: text(source.gender, "Jenis Kelamin", nik),
    status: text(source.status, "Status Kontrak", nik),
    payroll: text(source.payroll, "Payroll", nik),
    school: text(source.school, "Sekolah", nik),
    groupJenjang,
    jenjang,
    program: text(source.program, "Program", nik),
    teacherCategory: text(source.teacherCategory, "Kategori Guru", nik),
    subject: text(source.subject, "Bidang Studi", nik),
    schoolCount: locations.length,
    crossLevel: text(source.crossLevel, "Lintas Jenjang", nik),
    locations,
    statusIndividu: text(source.statusIndividu, "Status Individu", nik),
    isWakasek: Boolean(source.isWakasek),
    isBK: Boolean(source.isBK),
    jtm,
    taskHours,
    actual,
    taskCount: tasks.length,
    tasks,
    className: String(source.className ?? "-").trim() || "-",
    compliance: actual < threshold ? "Di bawah standar" : actual === threshold ? "Tepat standar" : "Di atas standar",
    year: text(source.year, "Tahun Pelajaran", nik).replace(/\s*\/\s*/g, "/"),
  };
}

function validateDatabase(teachers: Teacher[]) {
  if (teachers.length !== EXPECTED_TOTAL) {
    throw new Error(`Database guru tidak valid: ditemukan ${teachers.length} NIK, seharusnya ${EXPECTED_TOTAL}.`);
  }
  const uniqueNiks = new Set(teachers.map((teacher) => teacher.nik));
  if (uniqueNiks.size !== teachers.length) {
    throw new Error(`Database guru tidak valid: ditemukan ${teachers.length - uniqueNiks.size} NIK duplikat.`);
  }
  const nonKasek = teachers.filter((teacher) => teacher.statusIndividu === "Non-Kasek");
  for (const [category, expected] of Object.entries(EXPECTED_NON_KASEK_CATEGORIES)) {
    const actual = nonKasek.filter((teacher) => teacher.teacherCategory === category).length;
    if (actual !== expected) {
      throw new Error(`Database guru tidak valid: ${category} berjumlah ${actual}, seharusnya ${expected}.`);
    }
  }
}

export function readTeacherDatabase() {
  if (cachedTeachers) return cachedTeachers;
  const compressed = readFileSync(join(process.cwd(), "app", "data", "teachers.json.gz"));
  const source = JSON.parse(gunzipSync(compressed).toString("utf8")) as unknown;
  if (!Array.isArray(source)) throw new Error("Database guru tidak valid: format utama harus berupa array.");
  const teachers = source.map(normalizeTeacher).sort((a, b) => a.nik.localeCompare(b.nik, "id"));
  validateDatabase(teachers);
  cachedTeachers = teachers;
  return teachers;
}
