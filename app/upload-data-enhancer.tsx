"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./upload-data.module.css";

type Issue = { sheet: string; row: number; field: string; message: string; value?: string };
type Validation = {
  ok: boolean;
  sourceName?: string;
  years?: string[];
  counts?: { profiles: number; assignments: number; tasks: number };
  errors?: Issue[];
  warnings?: Issue[];
  preview?: Array<{ year: string; nik: string; name: string; jenjang: string; school: string; subject: string; jtm: number }>;
  message?: string;
};

export default function UploadDataEnhancer() {
  const [navTarget, setNavTarget] = useState<HTMLElement | null>(null);
  const [mainTarget, setMainTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [googleUrl, setGoogleUrl] = useState("");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [busy, setBusy] = useState<"validate" | "import" | null>(null);
  const [result, setResult] = useState("");

  useEffect(() => {
    const sync = () => {
      setNavTarget(document.querySelector<HTMLElement>(".sidebar nav"));
      setMainTarget(document.querySelector<HTMLElement>(".main-content"));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mainTarget) return;
    mainTarget.classList.toggle("data-upload-open", open);
    return () => mainTarget.classList.remove("data-upload-open");
  }, [mainTarget, open]);

  const sourceReady = Boolean(file || googleUrl.trim());
  const canImport = Boolean(validation?.ok && sourceReady && !busy);
  const issues = useMemo(() => [...(validation?.errors || []), ...(validation?.warnings || [])], [validation]);

  function resetValidation() { setValidation(null); setResult(""); }

  function buildFormData() {
    const form = new FormData();
    if (file) form.set("file", file);
    if (!file && googleUrl.trim()) form.set("googleUrl", googleUrl.trim());
    return form;
  }

  async function validate() {
    if (!sourceReady) return;
    setBusy("validate"); setResult("");
    try {
      const response = await fetch("/api/data-import/validate", { method: "POST", body: buildFormData() });
      const payload = await response.json();
      setValidation(payload);
      if (!response.ok && !payload.errors) setResult(payload.message || "File tidak dapat divalidasi.");
    } catch { setResult("Tidak dapat menghubungi server validasi."); }
    finally { setBusy(null); }
  }

  async function importData() {
    if (!canImport) return;
    setBusy("import"); setResult("");
    try {
      const response = await fetch("/api/data-import/import", { method: "POST", body: buildFormData() });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        setResult(`✓ ${payload.message} ${payload.counts?.profiles || 0} profil guru diproses.`);
      } else {
        setResult(payload.message || "Import gagal.");
        if (payload.errors) setValidation((current) => ({ ...(current || { ok: false }), ok: false, errors: payload.errors, warnings: payload.warnings || [] }));
      }
    } catch { setResult("Tidak dapat menghubungi server import."); }
    finally { setBusy(null); }
  }

  const nav = navTarget ? createPortal(
    <button type="button" className={open ? "active" : ""} onClick={() => setOpen(true)}>
      <span className="menu-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0-11-4 4m4-4 4 4"/><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/></svg></span>
      <div><strong>Upload Data</strong><small>Import tahun pelajaran</small></div>
    </button>, navTarget
  ) : null;

  const page = open && mainTarget ? createPortal(
    <div className={`data-upload-portal ${styles.page}`}>
      <header className={styles.topbar}>
        <div><p>Administrasi Data</p><h1>Upload Data Tahun Pelajaran</h1></div>
        <button type="button" className={styles.back} onClick={() => setOpen(false)}>← Kembali ke Dashboard</button>
      </header>

      <main className={styles.body}>
        <section className={styles.hero}>
          <div><span className={styles.eyebrow}>DATA MASTER</span><h2>Tambah data tanpa mengubah struktur dashboard</h2><p>Gunakan satu template yang sama setiap tahun. Sistem akan memvalidasi NIK, tahun pelajaran, jenjang, penugasan, tugas tambahan, dan referensi antar-sheet sebelum data boleh masuk ke database.</p></div>
          <div className={styles.heroActions}><a className={styles.primaryLink} href="/api/data-import/template">↓ Download Template Excel</a><small>Template sudah berisi contoh pengisian 2026/2027.</small></div>
        </section>

        <section className={styles.steps}>
          <article><strong>1</strong><div><h3>Download & isi template</h3><p>Jangan mengubah nama sheet dan nama header kolom.</p></div></article>
          <article><strong>2</strong><div><h3>Excel atau Google Sheets</h3><p>Boleh isi langsung di Excel, atau upload template ke Google Drive lalu buka sebagai Google Sheets.</p></div></article>
          <article><strong>3</strong><div><h3>Validasi lalu import</h3><p>Database hanya berubah setelah validasi tidak memiliki error.</p></div></article>
        </section>

        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardHead}><div><span>SUMBER DATA</span><h3>Upload file Excel</h3></div><b>.xlsx / .xls</b></div>
            <div className={styles.templateShortcut}>
              <div><strong>Belum punya format datanya?</strong><small>Gunakan template resmi dashboard yang sudah dilengkapi petunjuk dan contoh pengisian.</small></div>
              <a href="/api/data-import/template">Download Template + Contoh</a>
            </div>
            <label className={styles.dropzone}>
              <input type="file" accept=".xlsx,.xls" onChange={(event) => { setFile(event.target.files?.[0] || null); if (event.target.files?.[0]) setGoogleUrl(""); resetValidation(); }} />
              <span className={styles.uploadIcon}>↑</span><strong>{file ? file.name : "Pilih file Excel"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Maksimal 15 MB"}</small>
            </label>
            <div className={styles.or}><span />atau<span /></div>
            <label className={styles.urlField}><span>Link Google Sheets</span><input type="url" placeholder="https://docs.google.com/spreadsheets/d/..." value={googleUrl} onChange={(event) => { setGoogleUrl(event.target.value); if (event.target.value) setFile(null); resetValidation(); }} /><small>Atur akses Google Sheets menjadi “Siapa saja yang memiliki link dapat melihat”.</small></label>
            <button className={styles.validateButton} type="button" disabled={!sourceReady || Boolean(busy)} onClick={validate}>{busy === "validate" ? "Memvalidasi…" : "Periksa & Validasi Data"}</button>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><div><span>STRUKTUR TEMPLATE</span><h3>Apa yang perlu diisi?</h3></div></div>
            <div className={styles.sheetList}>
              <article><b>PROFIL_GURU</b><p>Satu baris per guru per tahun pelajaran. Berisi identitas, status, sekolah utama, jenjang, program, bidang studi, dan JTM.</p></article>
              <article><b>PENUGASAN_MENGAJAR</b><p>Satu guru boleh memiliki banyak baris untuk sekolah, mapel, dan kelas berbeda. Jumlah lokasi dihitung otomatis.</p></article>
              <article><b>TUGAS_TAMBAHAN</b><p>Satu guru boleh memiliki banyak tugas. Jam Aktual dan jumlah tugas dihitung otomatis dari data ini.</p></article>
            </div>
            <div className={styles.derived}><strong>Tidak perlu diisi manual</strong><span>Jam Aktual</span><span>Jumlah Lokasi</span><span>Jumlah Tugas</span><span>Status Kepatuhan</span></div>
          </section>
        </div>

        {validation && <section className={`${styles.card} ${styles.validation}`}>
          <div className={styles.validationHead}><div><span>HASIL VALIDASI</span><h3>{validation.ok ? "Data siap diimport" : "Perbaiki data sebelum import"}</h3></div><div className={validation.ok ? styles.okBadge : styles.errorBadge}>{validation.ok ? "VALID" : `${validation.errors?.length || 0} ERROR`}</div></div>
          <div className={styles.stats}><div><span>TP</span><strong>{validation.years?.join(", ") || "-"}</strong></div><div><span>Profil Guru</span><strong>{validation.counts?.profiles || 0}</strong></div><div><span>Penugasan</span><strong>{validation.counts?.assignments || 0}</strong></div><div><span>Tugas Tambahan</span><strong>{validation.counts?.tasks || 0}</strong></div></div>
          {issues.length > 0 && <div className={styles.issues}><h4>Error / Peringatan</h4>{issues.slice(0, 30).map((issue, index) => <div key={`${issue.sheet}-${issue.row}-${index}`} className={(validation.errors || []).includes(issue) ? styles.issueError : styles.issueWarning}><b>{issue.sheet}{issue.row ? ` · baris ${issue.row}` : ""}</b><span>{issue.field}: {issue.message}</span></div>)}</div>}
          {(validation.preview?.length || 0) > 0 && <div className={styles.preview}><h4>Preview Profil Guru</h4><div className={styles.tableWrap}><table><thead><tr><th>TP</th><th>NIK</th><th>Nama</th><th>Jenjang</th><th>Sekolah</th><th>Bidang Studi</th><th>JTM</th></tr></thead><tbody>{validation.preview!.map((row) => <tr key={`${row.year}-${row.nik}`}><td>{row.year}</td><td>{row.nik}</td><td>{row.name}</td><td>{row.jenjang}</td><td>{row.school}</td><td>{row.subject}</td><td>{row.jtm}</td></tr>)}</tbody></table></div></div>}
          <div className={styles.importBar}><div><strong>Import aman per NIK + Tahun Pelajaran</strong><small>Data tahun lain tidak dihapus. NIK yang tidak ada di file juga tidak disentuh.</small></div><button type="button" disabled={!canImport} onClick={importData}>{busy === "import" ? "Mengimport…" : "Import ke Database"}</button></div>
        </section>}
        {result && <div className={styles.result}>{result}</div>}
      </main>
    </div>, mainTarget
  ) : null;

  return <>{nav}{page}</>;
}
