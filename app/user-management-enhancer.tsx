"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./user-management.module.css";

type LoginUser = {
  id: number;
  email: string;
  displayName: string;
  role: string;
  active: boolean;
  createdAt: string;
};

function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.8-3.5 2.7-5 5.5-5s4.7 1.5 5.5 5"/><path d="M16 11.5 18 14l3.5-4.5"/></svg>;
}

export default function UserManagementEnhancer() {
  const [navTarget, setNavTarget] = useState<HTMLElement | null>(null);
  const [mainTarget, setMainTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    mainTarget.classList.toggle("user-management-open", open);
    return () => mainTarget.classList.remove("user-management-open");
  }, [mainTarget, open]);

  useEffect(() => {
    if (!open) return;
    void loadUsers();
  }, [open]);

  async function loadUsers() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Gagal memuat user.");
      setUsers(payload.users || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat user.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          displayName: form.get("displayName"),
          role: form.get("role"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Gagal menyimpan user.");
      event.currentTarget.reset();
      setMessage("User berhasil disimpan dan dapat login via SSO.");
      await loadUsers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan user.");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(user: LoginUser, active: boolean) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Gagal memperbarui user.");
      await loadUsers();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Gagal memperbarui user.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(user: LoginUser) {
    if (!window.confirm(`Hapus akses login untuk ${user.email}?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Gagal menghapus user.");
      await loadUsers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus user.");
    } finally {
      setBusy(false);
    }
  }

  const nav = navTarget ? createPortal(
    <button data-user-nav="true" type="button" className={open ? "active" : ""} onClick={() => setOpen(true)}>
      {/* <span className="menu-icon"><UserIcon /></span>
      <div><strong>Kelola User</strong><small>Akses SSO</small></div> */}
    </button>, navTarget
  ) : null;

  const page = open && mainTarget ? createPortal(
    <div className={`${styles.portal} ${styles.page}`}>
      <header className={styles.topbar}>
        <div><p>Administrasi Akses</p><h1>Kelola User Login SSO</h1></div>
        <button type="button" className={styles.back} onClick={() => setOpen(false)}>Kembali ke Dashboard</button>
      </header>
      <main className={styles.body}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>DATABASE USER</span>
          <h2>Tambahkan email yang boleh masuk ke dashboard.</h2>
          <p>User aktif di daftar ini dapat login menggunakan Google SSO. User nonaktif tetap tersimpan, tetapi tidak bisa membuat sesi baru.</p>
        </section>
        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardHead}><div><span>Tambah User</span><h3>Email SSO</h3></div></div>
            <form className={styles.form} onSubmit={submit}>
              <label className={styles.field}><span>Email</span><input name="email" type="email" placeholder="nama@penaburjakarta.or.id" required /></label>
              <label className={styles.field}><span>Nama Tampilan</span><input name="displayName" placeholder="Opsional" /></label>
              <label className={styles.field}><span>Role</span><select name="role" defaultValue="user"><option value="user">User</option><option value="admin">Admin</option></select></label>
              <button className={styles.submit} type="submit" disabled={busy}>{busy ? "Menyimpan..." : "Simpan User"}</button>
            </form>
            {message ? <p className={styles.message}>{message}</p> : null}
            {error ? <p className={`${styles.message} ${styles.error}`}>{error}</p> : null}
          </section>
          <section className={styles.card}>
            <div className={styles.cardHead}><div><span>Daftar User</span><h3>{users.length} akun tersimpan</h3></div></div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Dibuat</th><th /></tr></thead>
                <tbody>
                  {users.map((user) => <tr key={user.id}>
                    <td className={styles.email}><strong>{user.email}</strong><small>{user.displayName || "-"}</small></td>
                    <td><span className={styles.badge}>{user.role}</span></td>
                    <td><span className={`${styles.badge} ${user.active ? "" : styles.inactive}`}>{user.active ? "Aktif" : "Nonaktif"}</span></td>
                    <td>{new Date(user.createdAt).toLocaleDateString("id-ID")}</td>
                    <td className={styles.actions}>
                      <button type="button" disabled={busy} onClick={() => setActive(user, !user.active)}>{user.active ? "Nonaktifkan" : "Aktifkan"}</button>
                      <button type="button" disabled={busy} className={styles.danger} onClick={() => remove(user)}>Hapus</button>
                    </td>
                  </tr>)}
                </tbody>
              </table>
              {!busy && users.length === 0 ? <div className={styles.empty}>Belum ada user database.</div> : null}
              {busy && users.length === 0 ? <div className={styles.empty}>Memuat user...</div> : null}
            </div>
          </section>
        </div>
      </main>
    </div>, mainTarget
  ) : null;

  return <>{nav}{page}</>;
}
