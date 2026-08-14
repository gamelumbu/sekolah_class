"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setError(result?.message || "Login gagal. Silakan coba kembali.");
    setLoading(false);
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <Image src="/logo-bpk-penabur-jakarta.png" alt="Logo BPK PENABUR Jakarta" width={104} height={124} priority />
        <div>
          <p>Dashboard Tenaga Pendidik</p>
          <h1>BPK PENABUR Jakarta</h1>
          <span>Bagian Sistem dan Analitik Data<br />Bagian Riset dan Pengembangan</span>
        </div>
      </section>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-lock" aria-hidden="true">●</div>
        <p className="login-eyebrow">Akses terbatas</p>
        <h2 id="login-title">Masuk ke dashboard</h2>
        <p className="login-description">Gunakan akun yang telah diberikan oleh administrator untuk melihat data tenaga pendidik.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Nama pengguna</label>
          <input id="username" name="username" autoComplete="username" required autoFocus />
          <label htmlFor="password">Kata sandi</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={loading}>{loading ? "Memverifikasi…" : "Masuk"}</button>
        </form>
        <small>Sesi berakhir otomatis setelah 8 jam.</small>
      </section>
    </main>
  );
}
