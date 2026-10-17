# Verifikasi Aplikasi HeuriLab

## Verifikasi Pembaruan UI & Fitur Lengkap (17 Oktober 2026)

Tanggal: 17 Oktober 2026. Lingkungan: Windows, Bun 1.4.2, Node.js 22.22.0.
Browser: Google Chrome dan Microsoft Edge.

### Hasil Akhir Pemeriksaan

| Pemeriksaan                                 | Hasil                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| Oxfmt format check                          | Lulus (`bun run format:check`)                                           |
| Oxlint dengan deny-warnings                 | Lulus, tanpa warning/error kode (`bun run lint`)                         |
| TypeScript strict                           | Lulus (`tsc -b`)                                                         |
| Pengujian domain/engine/adapter melalui Bun | 24 lulus, 0 gagal; 5.485 assertions (`bun run test`)                     |
| Build produksi Vite                         | Lulus (`vite build`)                                                     |
| Playwright pada build produksi              | 16 lulus, 0 gagal: 8 skenario di Google Chrome dan Microsoft Edge        |
| Screenshot desktop & mobile                 | Ditinjau; layout 1366×768, 768×1024, dan 390×844                         |
| Aksesibilitas modal Panduan                 | Focus trap, ARIA dialog, tab keyboard, Escape, scroll lock terverifikasi |

Perintah yang dijalankan: `bun run check` dan `bun run test:e2e`.

### Cakupan Domain Tambahan (17 Oktober 2026)

- **Nearest Farthest Insertion (NFI):** Mulai dari node awal dan node terdekat, memilih node di luar tour dengan jarak minimum-ke-tour terbesar, menyisipkan pada sisi dengan delta kenaikan minimum, tie-break deterministik ID dan posisi sisi.
- **3-OPT Local Search:** Evaluasi triple sisi tidak bersebelahan $(i, j, k)$, 4 rekoneksi valid pembentuk siklus tunggal, perbaikan biaya terbaik (`best improvement`) dengan toleransi $\varepsilon = 10^{-9}$, deterministik, dan penanganan dataset kecil ($N < 6$) tanpa kandidat valid.
- **Durasi Bertahap (Stage Durations):** Pemisahan waktu milidetik tahap konstruksi, perbaikan awal (2-OPT/3-OPT), dan pencarian metaheuristik, serta total waktu.
- **Migrasi Sesi v1 ke v2:** Kompatibilitas mundur format sesi IndexedDB; konversi `improve: true -> "2OPT"` dan `false -> "none"` serta pemeliharaan seluruh riwayat 10 run dan trace lama.
- **Ekspor CSV & JSON:** CSV memuat kolom kategori, metode awal/perbaikan, parameter lengkap ($\alpha, T_{\min}$, seed), durasi bertahap, status, dan rute; JSON memuat snapshot detail run.

### Cakupan Browser E2E

1. **Alur TS → Report Leaderboard → SA → perbandingan CSV & JSON → refresh:** Menjalankan TS, memeriksa leaderboard Report, menjalankan SA dengan snapshot rute identik, mengekspor perbandingan CSV/JSON, dan memverifikasi persistensi sesi setelah reload.
2. **Eksekusi Eksperimen per Kategori:** Menjalankan Konstruksi (NFI), menjalankan Local Search (3-OPT), dan memverifikasi keduanya tercatat di riwayat dan leaderboard Report dengan kolom yang sesuai.
3. **Impor Excel Valid:** Pemilihan sheet, pemetaan kolom, preview, unduh template, dan penerapan dataset ke kanvas.
4. **Impor Invalid:** Menolak data invalid tanpa merusak dataset aktif serta menampilkan detail nomor baris sumber error.
5. **Responsivitas Komputasi:** Uji batching time-slice (12ms) worker pada dataset besar, jeda/lanjut, pembatalan, dan eksekusi run baru.
6. **Aksesibilitas Modal Panduan:** Verifikasi pembukaan dialog, focus trap, navigasi panah keyboard antar-tab, Escape, dan penguncian scroll latar belakang.
7. **Layout Responsif Mobile (390×844):** Tidak ada overflow horizontal halaman maupun dialog modal.
8. **Resiliensi Penyimpanan:** Penanganan sesi korup dan kegagalan IndexedDB tanpa menyebabkan aplikasi crash.

---

## Verifikasi Web MVP Sebelumnya (8 Oktober 2026)

Tanggal: 8 Oktober 2026. Lingkungan: Windows, Bun 1.4.2, Node.js 22.22.0.
Browser: Google Chrome 154.0.8037.98 dan Microsoft Edge 154.0.4258.62.

Pemeriksaan awal MVP mencakup 22 tes domain dan 18 run Playwright pada 9 skenario awal MVP. Hasil awal tersebut telah diintegrasikan dan diperbarui dengan cakupan fitur lengkap per 17 Oktober 2026.
