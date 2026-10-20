# HeuriLab

Laboratorium interaktif berbahasa Indonesia untuk mempelajari optimasi rute Traveling Salesman Problem.

Input dataset, bentuk solusi awal, jalankan Tabu Search atau Simulated Annealing, telusuri trace,
lalu bandingkan dan ekspor hasil. Seluruh perhitungan dan penyimpanan berlangsung di browser.

## Menjalankan lokal

Prasyarat: Bun 1.4.2 dan Node.js 22.12+; browser Chrome atau Edge.
Versi Node 22.22 dan Bun 1.4.2 digunakan pada pengembangan awal.

Jalankan perintah dari folder proyek HeuriLab:

```powershell
bun install --frozen-lockfile
bun run dev
```

Buka alamat yang ditampilkan, biasanya http://127.0.0.1:5173.
Biarkan terminal berjalan selama memakai aplikasi. Ctrl+C menghentikan server.

Untuk mencoba build produksi:

```powershell
bun run build
bun run preview
```

Alamat preview biasanya http://127.0.0.1:4173. Gunakan origin/port yang sama untuk membuka kembali
sesi tersimpan: penyimpanan browser pada port dev dan preview berbeda. Build berada di `dist/`
dan memerlukan server HTTP; membuka index.html sebagai file lokal tidak didukung.

## Deploy melalui GitHub Actions dan Coolify

GitHub Actions memeriksa proyek dengan `bun run check`, membangun image AMD64, lalu mem-push
`kkafi09/heurilab:latest` dan tag commit ke Docker Hub. Workflow berjalan saat ada push ke `main`;
workflow juga dapat dijalankan manual dari branch `main`. Coolify hanya dipicu setelah pemeriksaan
dan push image berhasil.

### Siapkan GitHub Actions

Tambahkan repository secrets berikut di **Settings → Secrets and variables → Actions**:

| Secret                   | Isi                                                                |
| ------------------------ | ------------------------------------------------------------------ |
| `DOCKERHUB_USERNAME`     | Username akun Docker Hub yang dapat mem-push ke `kkafi09/heurilab` |
| `DOCKERHUB_TOKEN`        | Access token Docker Hub dengan izin push ke repository tersebut    |
| `COOLIFY_DEPLOY_WEBHOOK` | URL deploy webhook terautentikasi dari aplikasi Coolify            |
| `COOLIFY_TOKEN`          | API token Coolify dengan izin deploy                               |

Jangan simpan nilai secret di repository. Pastikan repository `kkafi09/heurilab` tersedia dan public
di Docker Hub.

### Siapkan aplikasi Coolify

1. Buat aplikasi bertipe **Docker Image** dan gunakan `kkafi09/heurilab:latest` sebagai image.
2. Atur port internal aplikasi ke `80`. Coolify mengambil image dari Docker Hub; build tetap
   dilakukan GitHub Actions.
3. Salin URL deploy webhook dari pengaturan aplikasi. Buat API token Coolify dengan izin deploy,
   lalu simpan URL dan token sebagai `COOLIFY_DEPLOY_WEBHOOK` dan `COOLIFY_TOKEN` di GitHub Actions.
   Pada Coolify self-hosted, aktifkan API access di pengaturan Advanced jika belum aktif.
4. Push perubahan ke `main` atau jalankan workflow manual dari `main`. Periksa GitHub Actions,
   lalu status deployment aplikasi di Coolify.

Image memuat situs statis Nginx pada port 80. Data sesi dan riwayat eksperimen tetap tersimpan lokal
di browser pengguna.

## Cara menggunakan

1. Gunakan contoh sintetis enam node, generate dataset acak via **Generator** (Uniform / Cluster hingga 100 node dengan seed data), atau edit tabel ID/X/Y. Klik **Terapkan** setelah selesai.
2. Untuk Excel, klik **Impor Excel**, pilih .xlsx, pilih sheet dan kolom, periksa preview,
   lalu **Terapkan impor**. **Unduh template** menghasilkan workbook dengan contoh enam node.
3. Pilih **Jenis Eksperimen**:
   - **Konstruksi:** Bangun tour awal dengan **Nearest Neighbor (NN)**, **Nearest Insertion (NI)**, atau **Nearest Farthest Insertion (NFI)** dari titik awal pilihan.
   - **Local Search:** Gunakan rute dasar acak atau konstruktif, lalu lakukan perbaikan turunan deterministik dengan **2-OPT** atau **3-OPT**.
   - **Metaheuristik:** Pilih **Tabu Search (TS)** atau **Simulated Annealing (SA)**, tentukan pembentuk tour awal (**Rute acak**, **NN**, **NI**, atau **NFI**), perbaikan awal (Tidak ada / 2-OPT / 3-OPT), serta parameter pencarian.
4. Tentukan parameter, kemudian **Jalankan eksperimen**.
5. Gunakan **Jeda**, **Lanjutkan**, atau **Batalkan**. Best-so-far tetap tersedia setelah cancel.
6. Pada TS/SA, telusuri **Trace iterasi** untuk melihat candidate/current/best dan alasan keputusan.
   Klik nomor iterasi untuk melihat snapshot rute pada langkah tersebut.
7. Buka tab **Report** untuk melihat ringkasan metrik, evaluasi perbandingan, rincian durasi bertahap
   (konstruksi, persiapan perbaikan, dan pencarian), serta ekspor.
   Tombol **Jalankan metode lain** memungkinkan perbandingan adil dengan snapshot dataset dan rute awal yang identik.
8. **Ekspor JSON** menyimpan dataset, parameter, rute, dan trace lengkap. **Ekspor CSV** menyimpan ringkasan perbandingan.

UI menyediakan **Panduan**; aturan algoritma dan parameter dijelaskan lengkap dalam `docs/METHODOLOGY.md`.

## Data dan parameter

- 3–100 node; ID wajib unik; koordinat harus angka finite. Koordinat berimpit diperbolehkan.
- Generator acak mendukung 3–100 node dengan sebaran **Uniform (Merata)** di [-100, 100] atau **Cluster (Kelompok)** Gaussian (1–10 pusat cluster di [-60, 60] dengan $\sigma = 12$).
- Rute acak awal dibentuk murni melalui permutasi Fisher-Yates tanpa pra-optimasi tersembunyi hingga pengguna menjalankan algoritma.
- **Seed Data** (0–4.294.967.295) mengontrol penempatan koordinat dan rute acak awal. **Seed SA** berdiri sendiri dan terpisah untuk probabilitas penerimaan annealing.
- Jarak Euclidean planar, satuan **unit koordinat**. Kalkulasi presisi penuh; pembulatan hanya di UI.
- Excel .xlsx maksimum 10 MB; header default `id`, `x`, `y`, atau kolom dipetakan manual.
- Angka desimal memakai titik ketika dimasukkan. Baris kosong Excel dilewati; error memuat nomor baris sumber.
- Sheet dengan lebih dari 1.001 baris data/blank ditolak untuk menjaga preview terbatas tanpa memotong data diam-diam.
- Parameter default TS: 2.000 iterasi maksimum, tabu tenure 7.
- Parameter default SA: seed 42, suhu awal 100, cooling rate ($\alpha$) 0,95, 20 iterasi per suhu, suhu minimum ($T_{\min}$) 0,001. Batas iterasi maksimum 10.000.
- Jarak awal contoh NN sudah optimal pada fixture enam node: **24,686074230319797** unit. Improvement 0%
  pada contoh adalah hasil yang sah; TS/SA tetap dapat memperlihatkan eksplorasi pencarian.
- TS default pada contoh enam node dapat berhenti karena seluruh kandidat menjadi tabu. Ini alasan berhenti yang sah.

## Perintah pengembangan

| Perintah                          | Fungsi                                           |
| --------------------------------- | ------------------------------------------------ |
| `bun run dev`                     | Server pengembangan                              |
| `bun run lint` / `lint:fix`       | Oxlint / perbaikan otomatis                      |
| `bun run format` / `format:check` | Oxfmt / pemeriksaan format                       |
| `bun run typecheck`               | Pemeriksaan TypeScript strict                    |
| `bun run test`                    | Pengujian domain dan adapter murni melalui Bun   |
| `bun run test:e2e`                | Build produksi dan pengujian browser Chrome/Edge |
| `bun run build` / `preview`       | Build produksi / server preview                  |
| `bun run check`                   | Format, lint, domain tests, dan build/typecheck  |

Pengujian browser memakai Chrome dan Edge yang terpasang. Jika hanya salah satu tersedia,
jalankan `bun run test:e2e -- --project=chrome` atau `--project=edge`.
Screenshot/trace pengujian berada di `test-results/` dan tidak termasuk source proyek.

## Penyimpanan dan troubleshooting

Sesi tersimpan otomatis di IndexedDB (versi format 2 dengan migrasi otomatis dari versi 1): dataset aktif,
parameter valid terakhir, dan 10 run terminal beserta trace. Tunggu indikator **Tersimpan lokal** sebelum menutup tab.
Draft belum diterapkan, run yang masih berjalan/dijeda, dan pilihan tampilan iterasi tidak dipulihkan setelah refresh.

Jika penyimpanan gagal atau sesi lama tidak valid, aplikasi tetap berjalan dalam memori. Ekspor hasil
sebelum menutup tab. Tombol **Simpan sesi saat ini** mencoba menyimpan workspace yang sedang tampil.
Menghapus data browser menghapus riwayat aplikasi.

Jika worker gagal, pesan error muncul dan eksperimen dapat dijalankan ulang. Jika parameter invalid,
perbaiki field yang dijelaskan pada pesan validasi. Bila port terpakai, pilih port lain dengan
`bun run dev -- --port 5174`; sesi pada port sebelumnya tetap terpisah.

## Batas rilis

Dataset contoh sintetis; kecocokan dataset dan formulasi dosen belum diverifikasi karena sumber tugas
belum tersedia. Heuristik tidak menjamin optimum pada dataset lain. Iterasi sama tidak berarti
beban komputasi sama: TS mengevaluasi seluruh neighborhood, SA satu kandidat per iterasi.

Tauri desktop, hosting publik, akun/backend, dan pitch deck mengikuti roadmap
setelah MVP. Rencana MVP ada pada [plans/MVP_PLAN.md](plans/MVP_PLAN.md); roadmap produk lengkap ada pada [plans/PLAN.md](plans/PLAN.md).

Komponen beUI gratis berlisensi MIT; atribusi dan lisensinya ada pada THIRD_PARTY_NOTICES.md.
