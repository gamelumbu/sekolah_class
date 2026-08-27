import * as XLSX from "xlsx";

export type ImportIssue = { sheet: string; row: number; field: string; message: string; value?: string };
export type ProfileRow = {
  year: string; nik: string; name: string; gender: string; status: string; statusIndividu: string;
  teacherCategory: string; school: string; payroll: string; groupJenjang: string; jenjang: string;
  program: string; subject: string; crossLevel: string; className: string; isWakasek: boolean; isBK: boolean; jtm: number;
};
export type AssignmentRow = { year: string; nik: string; school: string; subject: string; className: string; jtm: number; isPrimary: boolean };
export type TaskRow = { year: string; nik: string; taskName: string; taskCategory: string; hours: number; isPrimary: boolean };
export type ParsedImport = { profiles: ProfileRow[]; assignments: AssignmentRow[]; tasks: TaskRow[]; errors: ImportIssue[]; warnings: ImportIssue[]; years: string[] };

const PROFILE_SHEET = "PROFIL_GURU";
const ASSIGNMENT_SHEET = "PENUGASAN_MENGAJAR";
const TASK_SHEET = "TUGAS_TAMBAHAN";
const LEVELS = new Set(["TK", "SD", "SMP", "SLTA", "Internasional"]);
const INTERNATIONAL_GROUPS = new Set(["Primary", "Secondary"]);

function text(value: unknown) { return String(value ?? "").trim(); }
function year(value: unknown) { return text(value).replace(/\s*\/\s*/g, "/"); }
function nik(value: unknown) { const raw = text(value).replace(/\.0$/, ""); return raw ? raw.padStart(7, "0") : ""; }
function numberValue(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : NaN; }
function yesNo(value: unknown) { const v = text(value).toLocaleLowerCase("id-ID"); return ["ya", "yes", "y", "true", "1"].includes(v); }
function keys(row: Record<string, unknown>) { const result: Record<string, unknown> = {}; for (const [key, value] of Object.entries(row)) result[key.trim()] = value; return result; }
function addRequired(errors: ImportIssue[], sheet: string, row: number, field: string, value: string) { if (!value) errors.push({ sheet, row, field, message: `${field} wajib diisi.` }); }

function rowsOf(workbook: XLSX.WorkBook, sheetName: string, errors: ImportIssue[]) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) { errors.push({ sheet: sheetName, row: 0, field: "Sheet", message: `Sheet ${sheetName} tidak ditemukan.` }); return [] as Record<string, unknown>[]; }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false }).map(keys);
}

export function parseImportWorkbook(buffer: ArrayBuffer | Uint8Array): ParsedImport {
  const workbook = XLSX.read(buffer, { type: "array" });
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const profiles: ProfileRow[] = [];
  const assignments: AssignmentRow[] = [];
  const tasks: TaskRow[] = [];

  const profileRows = rowsOf(workbook, PROFILE_SHEET, errors);
  profileRows.forEach((source, index) => {
    const row = index + 2;
    const parsed: ProfileRow = {
      year: year(source["Tahun Pelajaran"]), nik: nik(source["NIK"]), name: text(source["Nama Lengkap"]), gender: text(source["Jenis Kelamin"]),
      status: text(source["Status Kontrak"]), statusIndividu: text(source["Status Individu"]), teacherCategory: text(source["Kategori Guru"]),
      school: text(source["Sekolah Utama"]), payroll: text(source["Payroll"]), groupJenjang: text(source["Grup Jenjang"]), jenjang: text(source["Jenjang"]),
      program: text(source["Program"]), subject: text(source["Bidang Studi Utama"]), crossLevel: text(source["Lintas Jenjang"]) || "-",
      className: text(source["Kelas Utama"]) || "-", isWakasek: yesNo(source["Wakasek"]), isBK: yesNo(source["BK"]), jtm: numberValue(source["JTM"]),
    };
    ["year","nik","name","gender","status","statusIndividu","teacherCategory","school","payroll","groupJenjang","jenjang","program","subject"].forEach((field) => addRequired(errors, PROFILE_SHEET, row, field, String(parsed[field as keyof ProfileRow] ?? "")));
    if (parsed.year && !/^\d{4}\/\d{4}$/.test(parsed.year)) errors.push({ sheet: PROFILE_SHEET, row, field: "Tahun Pelajaran", value: parsed.year, message: "Format harus YYYY/YYYY, contoh 2026/2027." });
    if (parsed.jenjang && !LEVELS.has(parsed.jenjang)) errors.push({ sheet: PROFILE_SHEET, row, field: "Jenjang", value: parsed.jenjang, message: "Jenjang harus TK, SD, SMP, SLTA, atau Internasional." });
    if (parsed.jenjang === "Internasional" && !INTERNATIONAL_GROUPS.has(parsed.groupJenjang)) errors.push({ sheet: PROFILE_SHEET, row, field: "Grup Jenjang", value: parsed.groupJenjang, message: "Internasional wajib memakai Primary atau Secondary." });
    if (parsed.jenjang && parsed.jenjang !== "Internasional" && parsed.groupJenjang !== parsed.jenjang) errors.push({ sheet: PROFILE_SHEET, row, field: "Grup Jenjang", value: parsed.groupJenjang, message: "Untuk TK–SLTA, Grup Jenjang harus sama dengan Jenjang." });
    if (!Number.isFinite(parsed.jtm) || parsed.jtm < 0) errors.push({ sheet: PROFILE_SHEET, row, field: "JTM", value: text(source["JTM"]), message: "JTM harus berupa angka >= 0." });
    profiles.push(parsed);
  });

  const profileKeys = new Set<string>();
  profiles.forEach((profile, index) => {
    const key = `${profile.year}|${profile.nik}`;
    if (profileKeys.has(key)) errors.push({ sheet: PROFILE_SHEET, row: index + 2, field: "NIK", value: profile.nik, message: `NIK duplikat pada Tahun Pelajaran ${profile.year}.` });
    profileKeys.add(key);
  });

  const assignmentRows = rowsOf(workbook, ASSIGNMENT_SHEET, errors);
  assignmentRows.forEach((source, index) => {
    const row = index + 2;
    const parsed: AssignmentRow = { year: year(source["Tahun Pelajaran"]), nik: nik(source["NIK"]), school: text(source["Sekolah"]), subject: text(source["Bidang Studi"]), className: text(source["Kelas"]) || "-", jtm: numberValue(source["JTM Penugasan"]), isPrimary: yesNo(source["Penugasan Utama"]) };
    addRequired(errors, ASSIGNMENT_SHEET, row, "Tahun Pelajaran", parsed.year); addRequired(errors, ASSIGNMENT_SHEET, row, "NIK", parsed.nik); addRequired(errors, ASSIGNMENT_SHEET, row, "Sekolah", parsed.school); addRequired(errors, ASSIGNMENT_SHEET, row, "Bidang Studi", parsed.subject);
    if (!Number.isFinite(parsed.jtm) || parsed.jtm < 0) errors.push({ sheet: ASSIGNMENT_SHEET, row, field: "JTM Penugasan", value: text(source["JTM Penugasan"]), message: "JTM Penugasan harus berupa angka >= 0." });
    if (parsed.year && parsed.nik && !profileKeys.has(`${parsed.year}|${parsed.nik}`)) errors.push({ sheet: ASSIGNMENT_SHEET, row, field: "NIK", value: parsed.nik, message: "NIK tidak ditemukan di PROFIL_GURU pada tahun pelajaran yang sama." });
    assignments.push(parsed);
  });

  const taskRows = rowsOf(workbook, TASK_SHEET, errors);
  taskRows.forEach((source, index) => {
    const row = index + 2;
    const parsed: TaskRow = { year: year(source["Tahun Pelajaran"]), nik: nik(source["NIK"]), taskName: text(source["Nama Tugas"]), taskCategory: text(source["Kategori Tugas"]), hours: numberValue(source["Jam Konversi"]), isPrimary: yesNo(source["Tugas Utama"]) };
    addRequired(errors, TASK_SHEET, row, "Tahun Pelajaran", parsed.year); addRequired(errors, TASK_SHEET, row, "NIK", parsed.nik); addRequired(errors, TASK_SHEET, row, "Nama Tugas", parsed.taskName);
    if (!Number.isFinite(parsed.hours) || parsed.hours < 0) errors.push({ sheet: TASK_SHEET, row, field: "Jam Konversi", value: text(source["Jam Konversi"]), message: "Jam Konversi harus berupa angka >= 0." });
    if (parsed.year && parsed.nik && !profileKeys.has(`${parsed.year}|${parsed.nik}`)) errors.push({ sheet: TASK_SHEET, row, field: "NIK", value: parsed.nik, message: "NIK tidak ditemukan di PROFIL_GURU pada tahun pelajaran yang sama." });
    tasks.push(parsed);
  });

  const assignmentSums = new Map<string, number>();
  assignments.forEach((item) => assignmentSums.set(`${item.year}|${item.nik}`, (assignmentSums.get(`${item.year}|${item.nik}`) || 0) + item.jtm));
  profiles.forEach((profile, index) => {
    const sum = assignmentSums.get(`${profile.year}|${profile.nik}`);
    if (sum !== undefined && Math.abs(sum - profile.jtm) > 0.001) warnings.push({ sheet: ASSIGNMENT_SHEET, row: index + 2, field: "JTM Penugasan", message: `Total JTM penugasan ${sum} berbeda dengan JTM profil ${profile.jtm} untuk NIK ${profile.nik}.` });
  });

  const years = [...new Set(profiles.map((item) => item.year).filter(Boolean))].sort();
  if (!profiles.length) errors.push({ sheet: PROFILE_SHEET, row: 0, field: "Data", message: "Tidak ada baris data guru yang dapat diimport." });
  if (years.length > 1) errors.push({ sheet: PROFILE_SHEET, row: 0, field: "Tahun Pelajaran", message: `Satu proses import hanya boleh memuat satu Tahun Pelajaran. Ditemukan: ${years.join(", ")}.` });
  return { profiles, assignments, tasks, errors, warnings, years };
}

export function googleSheetExportUrl(input: string) {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error("Link Google Sheets tidak valid.");
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
}
