import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const rows = JSON.parse(gunzipSync(readFileSync("app/data/teachers.json.gz")).toString("utf8"));
const errors = [];
const keys = new Set();
const years = new Set();

if (!Array.isArray(rows)) errors.push("Format database bukan array.");
if (!rows.length) errors.push("Database tidak memiliki baris data.");

for (const row of rows) {
  const nik = String(row.nik ?? "").trim().padStart(7, "0");
  const year = String(row.year ?? "").trim().replace(/\s*\/\s*/g, "/");
  const key = `${year}|${nik}`;

  if (!nik.trim()) errors.push("Ditemukan NIK kosong.");
  if (!/^\d{4}\/\d{4}$/.test(year)) errors.push(`Tahun Pelajaran tidak valid: ${nik} (${year || "kosong"}).`);
  if (keys.has(key)) errors.push(`NIK duplikat dalam TP ${year}: ${nik}.`);
  keys.add(key);
  years.add(year);

  if (!Number.isFinite(row.jtm) || row.jtm < 0 || !Number.isFinite(row.taskHours) || row.taskHours < 0 || !Number.isFinite(row.actual) || row.actual < 0) {
    errors.push(`Nilai jam tidak valid: ${nik}.`);
  }
  if (Math.abs(Number(row.actual) - (Number(row.jtm) + Number(row.taskHours))) > 0.001) {
    errors.push(`Jam Aktual tidak sama dengan JTM + Jam Tugas: ${nik}.`);
  }
  if (!Array.isArray(row.tasks) || row.taskCount !== new Set(row.tasks.map((item) => String(item).trim()).filter(Boolean)).size) {
    errors.push(`Jumlah tugas tidak konsisten: ${nik}.`);
  }
  if (!Array.isArray(row.locations) || row.schoolCount !== new Set(row.locations.map((item) => String(item).trim()).filter(Boolean)).size) {
    errors.push(`Jumlah lokasi tidak konsisten: ${nik}.`);
  }
  if (typeof row.isWakasek !== "boolean") errors.push(`isWakasek harus boolean: ${nik}.`);
  if (typeof row.isBK !== "boolean") errors.push(`isBK harus boolean: ${nik}.`);
  if (!["Kasek", "Non-Kasek"].includes(row.statusIndividu)) errors.push(`Status Individu tidak valid: ${nik}.`);
  if (row.jenjang === "Internasional" && !["Primary", "Secondary"].includes(row.groupJenjang)) errors.push(`Grup Jenjang Internasional tidak valid: ${nik}.`);
  if (row.jenjang !== "Internasional" && row.groupJenjang !== row.jenjang) errors.push(`Grup Jenjang tidak selaras: ${nik}.`);
}

if (errors.length) {
  console.error(`Validasi database gagal (${errors.length} temuan):`);
  console.error(errors.slice(0, 50).map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

const yearList = [...years].sort();
console.log(`Database valid: ${rows.length} baris; ${keys.size} kombinasi TP+NIK unik.`);
console.log(`Tahun Pelajaran tersedia: ${yearList.join(", ")}.`);
console.log("Seluruh angka dashboard akan dihitung dari data aktif; validator tidak menggunakan target jumlah historis.");
