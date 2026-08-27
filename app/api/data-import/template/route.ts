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
    ["Contoh Data", "Contoh di template mengikuti pola data cleansed TP 2025/2026, namun nama guru dan NIK dibuat sintetis."],
    ["NIK", "Gunakan NIK yang sama untuk orang yang sama pada setiap tahun pelajaran."],
    ["Tahun Pelajaran", "Format YYYY/YYYY, contoh 2025/2026."],
    ["Jam Aktual", "Tidak perlu diisi. Sistem menghitung dari JTM + total jam tugas tambahan."],
    ["Jumlah Lokasi", "Tidak perlu diisi. Sistem menghitung dari PENUGASAN_MENGAJAR."],
    ["Jumlah Tugas", "Tidak perlu diisi. Sistem menghitung dari TUGAS_TAMBAHAN."],
    ["Google Sheets", "Upload file template ini ke Google Drive dan buka sebagai Google Sheets. Jangan ubah nama sheet atau header kolom."],
    ["Import", "Dashboard memvalidasi file terlebih dahulu. Data hanya disimpan jika tidak ada error."],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guide);
  guideSheet["!cols"] = [{ wch: 24 }, { wch: 88 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, "PETUNJUK");

  const profileRows = [
    ["Tahun Pelajaran","NIK","Nama Lengkap","Jenis Kelamin","Status Kontrak","Status Individu","Kategori Guru","Sekolah Utama","Payroll","Grup Jenjang","Jenjang","Program","Bidang Studi Utama","Lintas Jenjang","Kelas Utama","Wakasek","BK","JTM"],
    ["2025/2026","9000001","Andi Pratama","Pria","PKWTT","Non-Kasek","Guru Nasional","SMPK PENABUR Gading Serpong","PGS","SMP","SMP","NASIONAL","Bahasa Indonesia","Satu Jenjang","7A","Tidak","Tidak",24],
    ["2025/2026","9000002","Sinta Maharani","Wanita","PKWTT","Non-Kasek","Guru Bilingual","SDK PENABUR Gading Serpong","DGS","SD","SD","BILINGUAL","Tematik","Satu Jenjang","3A","Tidak","Tidak",33],
    ["2025/2026","9000003","Rina Wijaya","Wanita","PKWTT","Non-Kasek","Guru Internasional","PENABUR Intercultural School - Primary Kelapa Gading","DKG","Primary","Internasional","INTERNASIONAL","SEMUA","Satu Jenjang","3C","Tidak","Tidak",22],
    ["2025/2026","9000004","Dedi Kurniawan","Pria","PKWTT","Non-Kasek","Guru Nasional","SMAK 7 PENABUR","A07","SLTA","SLTA","NASIONAL","Ekonomi","Satu Jenjang","X-2","Ya","Tidak",16],
    ["2025/2026","9000005","Maya Lestari","Wanita","PKWTT","Non-Kasek","Guru Nasional","SMAK 1 PENABUR","A01","SLTA","SLTA","NASIONAL","BK (Bimbingan Konseling)","Satu Jenjang","-","Tidak","Ya",24],
  ];
  const profileSheet = XLSX.utils.aoa_to_sheet(profileRows);
  profileSheet["!cols"] = profileRows[0].map((_, index) => ({ wch: [16,12,28,16,18,18,22,46,12,18,18,18,28,18,18,12,12,10][index] || 18 }));
  XLSX.utils.book_append_sheet(workbook, profileSheet, "PROFIL_GURU");

  const assignmentRows = [
    ["Tahun Pelajaran","NIK","Sekolah","Bidang Studi","Kelas","JTM Penugasan","Penugasan Utama"],
    ["2025/2026","9000001","SMPK PENABUR Gading Serpong","Bahasa Indonesia","7A",12,"Ya"],
    ["2025/2026","9000001","SMPK PENABUR Gading Serpong","Bahasa Indonesia","7B",12,"Tidak"],
    ["2025/2026","9000002","SDK PENABUR Gading Serpong","Tematik","3A",33,"Ya"],
    ["2025/2026","9000003","PENABUR Intercultural School - Primary Kelapa Gading","SEMUA","3C",22,"Ya"],
    ["2025/2026","9000004","SMAK 7 PENABUR","Ekonomi","X-2",16,"Ya"],
    ["2025/2026","9000005","SMAK 1 PENABUR","BK (Bimbingan Konseling)","-",24,"Ya"],
  ];
  const assignmentSheet = XLSX.utils.aoa_to_sheet(assignmentRows);
  assignmentSheet["!cols"] = [{wch:16},{wch:12},{wch:46},{wch:28},{wch:18},{wch:16},{wch:18}];
  XLSX.utils.book_append_sheet(workbook, assignmentSheet, "PENUGASAN_MENGAJAR");

  const taskRows = [
    ["Tahun Pelajaran","NIK","Nama Tugas","Kategori Tugas","Jam Konversi","Tugas Utama"],
    ["2025/2026","9000002","Wali Kelas","Wali Kelas",3,"Ya"],
    ["2025/2026","9000003","Koordinator Level Primary","Koordinator Level Primary",3,"Ya"],
    ["2025/2026","9000003","Wali Kelas","Wali Kelas",3,"Tidak"],
    ["2025/2026","9000004","Wakil Kepala Sekolah","Wakasek",12,"Ya"],
  ];
  const taskSheet = XLSX.utils.aoa_to_sheet(taskRows);
  taskSheet["!cols"] = [{wch:16},{wch:12},{wch:32},{wch:28},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(workbook, taskSheet, "TUGAS_TAMBAHAN");

  const refs = [
    ["Field", "Contoh Nilai"],
    ["Tahun Pelajaran", "2025/2026"],
    ["Jenis Kelamin", "Pria | Wanita"],
    ["Status Kontrak", "PKWTT | PKWT Penuh Waktu | sesuai data sumber"],
    ["Status Individu", "Non-Kasek | Kasek"],
    ["Jenjang", "TK | SD | SMP | SLTA | Internasional"],
    ["Grup Jenjang Nasional", "TK | SD | SMP | SLTA"],
    ["Grup Jenjang Internasional", "Primary | Secondary"],
    ["Program", "NASIONAL | BILINGUAL | INTERNASIONAL"],
    ["Kategori Guru", "Guru Nasional | Guru Bilingual | Guru Internasional"],
    ["Payroll", "Kode sekolah, contoh PGS | DGS | A07 | DKG"],
    ["Wakasek / BK", "Ya | Tidak"],
    ["Lintas Jenjang", "Satu Jenjang | Lintas"],
    ["JTM / Jam Konversi", "Angka >= 0"],
  ];
  const refSheet = XLSX.utils.aoa_to_sheet(refs);
  refSheet["!cols"] = [{wch:34},{wch:58}];
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
