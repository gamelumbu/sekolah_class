# Dashboard Tenaga Pendidik BPK PENABUR Jakarta

Dashboard analitik tenaga pendidik untuk jenjang TK, SD, SMP, SLTA, dan Internasional. Aplikasi menggunakan Next.js dan siap di-deploy ke Vercel.

## Fitur utama

- Filter multi-select, termasuk Grup Jenjang.
- Interaksi chart untuk menampilkan daftar karyawan terkait.
- Ekspor chart ke PNG dan data orang di dalam chart ke Excel.
- Standar kepatuhan 24 JP untuk jenjang reguler dan 30 JP khusus Internasional.
- Login server-side dengan cookie sesi bertanda tangan, `HttpOnly`, dan `Secure` di production.

## Menjalankan secara lokal

1. Salin `.env.example` menjadi `.env.local`.
2. Ganti seluruh nilai contoh dengan kredensial yang kuat.
3. Jalankan:

```bash
npm install
npm run dev
```

## Environment variables

| Nama | Keterangan |
| --- | --- |
| `DASHBOARD_USERNAME` | Nama pengguna untuk login dashboard. |
| `DASHBOARD_PASSWORD` | Kata sandi login. Jangan simpan nilai asli di GitHub. |
| `AUTH_SECRET` | String acak minimal 32 karakter untuk menandatangani cookie sesi. |

Untuk membuat `AUTH_SECRET`, jalankan `openssl rand -base64 48` di komputer Anda.

## Deploy ke Vercel

1. Impor repository ini di Vercel.
2. Framework akan terdeteksi sebagai **Next.js**; tidak perlu mengubah build command.
3. Tambahkan ketiga environment variable di atas untuk environment Production, Preview, dan Development sesuai kebutuhan.
4. Jalankan deployment.

> Data tenaga pendidik tersimpan di server bundle dan hanya dikirim setelah sesi login tervalidasi. Repository dibuat private dan kredensial tidak disimpan di source code.
