import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const EXPECTED_TOTAL = 2230;
const EXPECTED_NON_KASEK = {
  "Guru Nasional": 1867,
  "Guru Bilingual": 123,
  "Guru Internasional": 170,
};

const rows = JSON.parse(gunzipSync(readFileSync("app/data/teachers.json.gz")).toString("utf8"));
const errors = [];
const niks = new Set();

if (!Array.isArray(rows)) errors.push("Format database bukan array.");
if (rows.length !== EXPECTED_TOTAL) errors.push(`Total NIK ${rows.length}; seharusnya ${EXPECTED_TOTAL}.`);

for (const row of rows) {
  const nik = String(row.nik ?? "").trim().padStart(7, "0");
  if (!nik.trim()) errors.push("Ditemukan NIK kosong.");
  if (niks.has(nik)) errors.push(`NIK duplikat: ${nik}.`);
  niks.add(nik);
  if (!Number.isFinite(row.jtm) || !Number.isFinite(row.taskHours) || !Number.isFinite(row.actual)) errors.push(`Nilai jam tidak valid: ${nik}.`);
  if (row.actual !== row.jtm + row.taskHours) errors.push(`Jam Aktual tidak sama dengan JTM + Jam Tugas: ${nik}.`);
  if (!Array.isArray(row.tasks) || row.taskCount !== new Set(row.tasks).size) errors.push(`Jumlah tugas tidak konsisten: ${nik}.`);
  if (!Array.isArray(row.locations) || row.schoolCount !== new Set(row.locations).size) errors.push(`Jumlah lokasi tidak konsisten: ${nik}.`);
  if (row.jenjang === "Internasional" && !["Primary", "Secondary"].includes(row.groupJenjang)) errors.push(`Grup Jenjang Internasional tidak valid: ${nik}.`);
  if (row.jenjang !== "Internasional" && row.groupJenjang !== row.jenjang) errors.push(`Grup Jenjang tidak selaras: ${nik}.`);
}

const nonKasek = rows.filter((row) => row.statusIndividu === "Non-Kasek");
for (const [category, expected] of Object.entries(EXPECTED_NON_KASEK)) {
  const actual = nonKasek.filter((row) => row.teacherCategory === category).length;
  if (actual !== expected) errors.push(`${category}: ${actual}; seharusnya ${expected}.`);
}

if (errors.length) {
  console.error(`Validasi database gagal (${errors.length} temuan):`);
  console.error(errors.slice(0, 30).map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Database valid: ${rows.length} NIK unik; ${nonKasek.length} Non-Kasek; ${rows.length - nonKasek.length} Kasek.`);
console.log("Kategori Non-Kasek: Nasional 1.867; Bilingual 123; Internasional 170.");
