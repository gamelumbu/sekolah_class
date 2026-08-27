import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET() {
  const workbook = XLSX.utils.book_new();

  const guide = [
    ["TEMPLATE DATA TENAGA PENDIDIK - DASHBOARD SEKOLAH"],
    [],
    ["Bagian", "Keterangan"],
    ["Tujuan", "Template standar untuk menambahkan data tahun pelajaran baru ke Dashboard Sekolah."],
    ["Wajib diisi", "Isi PROFIL_GURU. Isi PENUGASAN_MENGAJAR dan TUGAS_TAMBAHAN sesuai kondisi guru."],
    ["NIK", "Gunakan NIK yang sama untuk orang yang sama pada setiap tahun pelajaran."],
    ["Tahun Pelajaran", "Format YYYY/YYYY, contoh 2026/2027."],
    ["Jam Aktual", "Tidak perlu diisi. Sistem menghitung dari JTM + total jam tugas tambahan."],
    ["Jumlah Lokasi", "Tidak perlu diisi. Sistem menghitung dari PENUGASAN_MENGAJAR."],
    ["Jumlah Tugas", "Tidak perlu diisi. Sistem menghitung dari TUGAS_TAMBAHAN."],
    ["Google Sheets", "Upload file template ini ke Google Drive dan buka sebagai Google Sheets. Jangan ubah nama sheet atau header kolom."],
    ["Import", "Dashboard memvalidasi file terlebih dahulu. Data hanya disimpan jika tidak ada error."],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guide);
  guideSheet["!cols"] = [{ wch: 24 }, { wch: 82 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, "PETUNJUK");

  const profileRows = [
    ["Tahun Pelajaran","NIK","Nama Lengkap","Jenis Kelamin","Status Kontrak","Status Individu","Kategori Guru","Sekolah Utama","Payroll","Grup Jenjang","Jenjang","Program","Bidang Studi Utama","Lintas Jenjang","Kelas Utama","Wakasek","BK","JTM"],
    ["2026/2027","0012345","Budi Santoso","Laki-laki","PKWTT","Non-Kasek","Guru Nasional","SMPK Contoh Jakarta","SMPK Contoh Jakarta","SMP","SMP","Nasional","Matematika","-","7A","Tidak","Tidak",24],
    ["2026/2027","0012346","Maria Setiawati","Perempuan","PKWT Penuh Waktu","Non-Kasek","Guru Nasional","SMAK Contoh Jakarta","SMAK Contoh Jakarta","SLTA","SLTA","Nasional","Bahasa Inggris","-","10 IPA 1","Ya","Tidak",12],
    ["2026/2027","0012347","Kevin Wijaya","Laki-laki","PKWTT","Non-Kasek","Guru Internasional","International School Example","International School Example","Secondary","Internasional","Internasional","Science","-","Grade 8","Tidak","Ya",20],
  ];
  const profileSheet = XLSX.utils.aoa_to_sheet(profileRows);
  profileSheet["!cols"] = profileRows[0].map((_, index) => ({ wch: [16,12,28,16,20,18,22,30,30,18,18,18,24,18,18,12,12,10][index] || 18 }));
  XLSX.utils.book_append_sheet(workbook, profileSheet, "PROFIL_GURU");

  const assignmentRows = [
    ["Tahun Pelajaran","NIK","Sekolah","Bidang Studi","Kelas","JTM Penugasan","Penugasan Utama"],
    ["2026/2027","0012345","SMPK Contoh Jakarta","Matematika","7A",12,"Ya"],
    ["2026/2027","0012345","SMPK Contoh Jakarta","Matematika","7B",12,"Tidak"],
    ["2026/2027","0012346","SMAK Contoh Jakarta","Bahasa Inggris","10 IPA 1",12,"Ya"],
    ["2026/2027","0012347","International School Example","Science","Grade 8",20,"Ya"],
  ];
  const assignmentSheet = XLSX.utils.aoa_to_sheet(assignmentRows);
  assignmentSheet["!cols"] = [{wch:16},{wch:12},{wch:30},{wch:24},{wch:18},{wch:16},{wch:18}];
  XLSX.utils.book_append_sheet(workbook, assignmentSheet, "PENUGASAN_MENGAJAR");

  const taskRows = [
    ["Tahun Pelajaran","NIK","Nama Tugas","Kategori Tugas","Jam Konversi","Tugas Utama"],
    ["2026/2027","0012346","Wakil Kepala Sekolah","Wakasek",12,"Ya"],
    ["2026/2027","0012347","Bimbingan Konseling","BK",6,"Ya"],
  ];
  const taskSheet = XLSX.utils.aoa_to_sheet(taskRows);
  taskSheet["!cols"] = [{wch:16},{wch:12},{wch:30},{wch:24},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(workbook, taskSheet, "TUGAS_TAMBAHAN");

  const refs = [
    ["Field", "Contoh Nilai"],
    ["Tahun Pelajaran", "2026/2027"],
    ["Jenis Kelamin", "Laki-laki | Perempuan"],
    ["Status Individu", "Non-Kasek | Kasek"],
    ["Jenjang", "TK | SD | SMP | SLTA | Internasional"],
    ["Grup Jenjang Nasional", "TK | SD | SMP | SLTA"],
    ["Grup Jenjang Internasional", "Primary | Secondary"],
    ["Kategori Guru", "Guru Nasional | Guru Bilingual | Guru Internasional"],
    ["Wakasek / BK", "Ya | Tidak"],
    ["JTM / Jam Konversi", "Angka >= 0"],
  ];
  const refSheet = XLSX.utils.aoa_to_sheet(refs);
  refSheet["!cols"] = [{wch:34},{wch:52}];
  XLSX.utils.book_append_sheet(workbook, refSheet, "REFERENSI");

  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template_Upload_Data_Dashboard_Sekolah.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
