"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import styles from "./login-form.module.css";

function Icon({ name }: { name: "chart" | "research" | "home" | "users" | "report" | "lock" | "user" | "eye" | "eye-off" | "arrow" | "shield" | "sso" }) {
  const paths = {
    chart: <><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M3 19h17"/></>,
    research: <><circle cx="10" cy="10" r="5"/><path d="m14 14 5 5"/><path d="M10 7v6M7 10h6"/></>,
    home: <><path d="m4 11 8-7 8 7"/><path d="M6.5 10.5V20h11v-9.5"/><path d="M10 20v-6h4v6"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.8-3.5 2.7-5 5.5-5s4.7 1.5 5.5 5"/><circle cx="17" cy="9" r="2"/><path d="M15.5 14.5c2.9-.4 4.8 1.1 5 4.5"/></>,
    report: <><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 11h6M9 15h6"/></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v2"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 20c1-4 3.5-6 7.5-6s6.5 2 7.5 6"/></>,
    eye: <><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.5"/></>,
    "eye-off": <><path d="M3 3l18 18"/><path d="M10.6 6.2A11.9 11.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17.7 17.7 0 0 1-2.2 2.8"/><path d="M6.6 6.6C3.8 8.2 2.5 12 2.5 12s3.5 6 9.5 6c1.4 0 2.6-.3 3.7-.7"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    shield: <><path d="M12 3 19 6v5c0 4.5-2.5 7.6-7 10-4.5-2.4-7-5.5-7-10V6z"/><path d="m9.5 12 1.7 1.7 3.7-4"/></>,
    sso: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 9h5"/><path d="M7 13h3"/><path d="M14.5 13.5 16 15l3-3"/></>,
  } as const;
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function getLoginErrorMessage(search: string) {
  const loginError = new URLSearchParams(search).get("login_error");
  const messages: Record<string, string> = {
    sso_not_configured: "Login SSO belum dikonfigurasi. Hubungi administrator dashboard.",
    sso_state: "Sesi login SSO tidak valid atau sudah kedaluwarsa. Silakan coba lagi.",
    sso_failed: "Login SSO gagal diproses. Pastikan akun Anda diizinkan mengakses dashboard.",
  };
  return loginError ? messages[loginError] || "" : "";
}

export default function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const message = getLoginErrorMessage(window.location.search);
    if (message) window.setTimeout(() => setError(message), 0);
    if (new URLSearchParams(window.location.search).has("login_error")) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    if (response.ok) {
      window.location.reload();
      return;
    }
    const result = await response.json().catch(() => null);
    setError(result?.message || "Login gagal. Silakan periksa kembali nama pengguna dan kata sandi.");
    setLoading(false);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-label="Tentang Dashboard Tenaga Pendidik">
        <div className={styles.heroInner}>
          <div className={styles.brandTop}>
            <div className={styles.logoWrap}>
              <Image className={styles.logo} src="/logo-bpk-penabur-jakarta.png" alt="Logo BPK PENABUR Jakarta" width={90} height={104} priority />
            </div>
            <div>
              <p className={styles.brandEyebrow}>Dashboard Tenaga Pendidik</p>
              <h1 className={styles.brandName}>BPK PENABUR <span>Jakarta</span></h1>
            </div>
          </div>

          <div className={styles.heroCopy}>
            <h2 className={styles.heroTitle}>Data yang lebih jelas untuk keputusan yang lebih tepat.</h2>
            <span className={styles.goldRule} aria-hidden="true" />
            <p className={styles.heroDescription}>Satu ruang analitik untuk melihat profil tenaga pendidik, beban kerja, penugasan, dan indikator utama secara ringkas dan terstruktur.</p>
            <div className={styles.teamList}>
              <div className={styles.teamItem}><span className={styles.teamIcon}><Icon name="chart" /></span><span>Bagian Sistem dan Analitik Data</span></div>
              <div className={styles.teamItem}><span className={styles.teamIcon}><Icon name="research" /></span><span>Bagian Riset dan Pengembangan</span></div>
            </div>
          </div>

          <div className={styles.preview} aria-hidden="true">
            <div className={styles.previewWindow}>
              <div className={styles.previewNav}>
                <div className={styles.previewNavMark} />
                <span><Icon name="home" /></span>
                <span><Icon name="users" /></span>
                <span><Icon name="report" /></span>
              </div>
              <div className={styles.previewContent}>
                <div className={styles.previewHead}>
                  <div><strong>Ringkasan Tenaga Pendidik</strong><small>Visualisasi data terverifikasi</small></div>
                  <span className={styles.previewStatus}>Aktif</span>
                </div>
                <div className={styles.metricGrid}>
                  <div className={styles.metric}><span>Total tenaga pendidik</span><strong>2.230</strong><small>Data aktif</small></div>
                  <div className={styles.metric}><span>Standar nasional</span><strong>24 JP</strong><small>TK–SLTA</small></div>
                  <div className={styles.metric}><span>Internasional</span><strong>30 JP</strong><small>Standar beban kerja</small></div>
                </div>
                <div className={styles.previewCharts}>
                  <div className={styles.chartBox}><strong>Distribusi tenaga pendidik</strong><div className={styles.bars}><i /><i /><i /><i /><i /><i /></div></div>
                  <div className={styles.chartBox}><strong>Komposisi kategori</strong><div className={styles.donutWrap}><div className={styles.donut} /></div></div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.wave} aria-hidden="true" />
        </div>
      </section>

      <section className={styles.loginSide}>
        <div className={styles.loginStack}>
          <section className={styles.loginCard} aria-labelledby="login-title">
            <div className={styles.loginHeader}>
              <div className={styles.loginIcon} aria-hidden="true"><Icon name="lock" /></div>
              <p className={styles.eyebrow}>Akses terbatas</p>
              <h2 className={styles.loginTitle} id="login-title">Masuk ke Dashboard</h2>
              <p className={styles.description}>Gunakan akun yang telah diberikan oleh administrator untuk mengakses data tenaga pendidik.</p>
            </div>

            <a className={styles.ssoButton} href="/api/auth/sso">
              <span className={styles.ssoIcon}><Icon name="sso" /></span>
              <span>Masuk dengan SSO</span>
            </a>

            <div className={styles.divider}><span>atau masuk manual</span></div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.fieldLabel} htmlFor="username">Nama pengguna</label>
              <div className={styles.inputShell}>
                <span className={styles.inputIcon}><Icon name="user" /></span>
                <input id="username" name="username" autoComplete="username" placeholder="Masukkan nama pengguna" required autoFocus />
              </div>

              <label className={styles.fieldLabel} htmlFor="password">Kata sandi</label>
              <div className={styles.inputShell}>
                <span className={styles.inputIcon}><Icon name="lock" /></span>
                <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Masukkan kata sandi" required />
                <button className={styles.visibilityButton} type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}>
                  <Icon name={showPassword ? "eye-off" : "eye"} />
                </button>
              </div>

              {error ? <p className={styles.error} role="alert">{error}</p> : null}

              <button className={styles.submitButton} type="submit" disabled={loading}>
                <span>{loading ? "Memverifikasi…" : "Masuk"}</span>
                {!loading && <span className={styles.buttonArrow}><Icon name="arrow" /></span>}
              </button>
            </form>
            <p className={styles.helpText}>Akun dashboard dikelola oleh administrator internal BPK PENABUR Jakarta.</p>
          </section>
          <div className={styles.securityNote}><span className={styles.securityIcon}><Icon name="shield" /></span><span>Akses aman · sesi berakhir otomatis setelah 8 jam.</span></div>
        </div>
      </section>
    </main>
  );
}
