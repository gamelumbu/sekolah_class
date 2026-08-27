import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { Teacher } from "@/app/dashboard-client";

const VALID_LEVELS = new Set(["TK", "SD", "SMP", "SLTA", "Internasional"]);
const VALID_GROUP_LEVELS = new Set(["TK", "SD", "SMP", "SLTA", "Primary", "Secondary"]);
const VALID_INDIVIDUAL_STATUS = new Set(["Kasek", "Non-Kasek"]);

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

function boolean(value: unknown, field: string, nik: string) {
  if (typeof value !== "boolean") throw new Error(`Database guru tidak valid: ${field} untuk NIK ${nik} harus boolean.`);
  return value;
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
  const statusIndividu = text(source.statusIndividu, "Status Individu", nik);
  const year = text(source.year, "Tahun Pelajaran", nik).replace(/\s*\/\s*/g, "/");
  const jtm = number(source.jtm, "JTM", nik);
  const taskHours = number(source.taskHours, "Jam Tugas", nik);
  const actual = number(source.actual, "Jam Aktual", nik);
  const tasks = stringList(source.tasks);
  const locations = stringList(source.locations);
  const threshold = jenjang === "Internasional" ? 30 : 24;

  if (!VALID_LEVELS.has(jenjang)) throw new Error(`Database guru tidak valid: Jenjang ${jenjang} untuk NIK ${nik}.`);
  if (!VALID_GROUP_LEVELS.has(groupJenjang)) throw new Error(`Database guru tidak valid: Grup Jenjang ${groupJenjang} untuk NIK ${nik}.`);
  if (!VALID_INDIVIDUAL_STATUS.has(statusIndividu)) throw new Error(`Database guru tidak valid: Status Individu ${statusIndividu} untuk NIK ${nik}.`);
  if (!/^\d{4}\/\d{4}$/.test(year)) throw new Error(`Database guru tidak valid: Tahun Pelajaran ${year} untuk NIK ${nik}.`);
  if (jenjang === "Internasional" && !["Primary", "Secondary"].includes(groupJenjang)) {
    throw new Error(`Database guru tidak valid: Grup Jenjang Internasional untuk NIK ${nik}.`);
  }
  if (jenjang !== "Internasional" && groupJenjang !== jenjang) {
    throw new Error(`Database guru tidak valid: Jenjang dan Grup Jenjang tidak selaras untuk NIK ${nik}.`);
  }
  if (Math.abs(actual - (jtm + taskHours)) > 0.001) {
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
    statusIndividu,
    isWakasek: boolean(source.isWakasek, "isWakasek", nik),
    isBK: boolean(source.isBK, "isBK", nik),
    jtm,
    taskHours,
    actual,
    taskCount: tasks.length,
    tasks,
    className: String(source.className ?? "-").trim() || "-",
    compliance: actual < threshold ? "Di bawah standar" : actual === threshold ? "Tepat standar" : "Di atas standar",
    year,
  };
}

function validateDatabase(teachers: Teacher[]) {
  if (!teachers.length) throw new Error("Database guru tidak valid: tidak ada data tenaga pendidik.");

  const uniqueKeys = new Set<string>();
  for (const teacher of teachers) {
    const key = `${teacher.year}|${teacher.nik}`;
    if (uniqueKeys.has(key)) throw new Error(`Database guru tidak valid: NIK ${teacher.nik} duplikat pada TP ${teacher.year}.`);
    uniqueKeys.add(key);
  }

  const years = new Set(teachers.map((teacher) => teacher.year));
  if (!years.size) throw new Error("Database guru tidak valid: Tahun Pelajaran tidak tersedia.");
}

export function readTeacherDatabase() {
  if (cachedTeachers) return cachedTeachers;
  const compressed = readFileSync(join(process.cwd(), "app", "data", "teachers.json.gz"));
  const source = JSON.parse(gunzipSync(compressed).toString("utf8")) as unknown;
  if (!Array.isArray(source)) throw new Error("Database guru tidak valid: format utama harus berupa array.");
  const teachers = source.map(normalizeTeacher).sort((a, b) => a.year.localeCompare(b.year, "id") || a.nik.localeCompare(b.nik, "id"));
  validateDatabase(teachers);
  cachedTeachers = teachers;
  return teachers;
}
