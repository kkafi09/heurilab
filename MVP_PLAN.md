# HeuriLab — Implementasi Web MVP

Status: diimplementasikan untuk penggunaan lokal. Tanggal: 8 Oktober 2026.

## Target rilis

Alur utama: dataset → solusi awal → TS/SA → visualisasi → trace → perbandingan → ekspor.
UI berbahasa Indonesia; sasaran browser Chrome dan Edge pada Windows.

MVP menyediakan NN, NI, 2-OPT best improvement, Tabu Search, dan Simulated Annealing.
Dataset 3–100 node memakai jarak Euclidean planar. Contoh enam node bersifat sintetis.
Impor .xlsx, penyimpanan IndexedDB, 10 run terakhir dengan trace, ekspor JSON/CSV, pause/resume,
dan cancel termasuk dalam rilis ini.

3-OPT, Tauri, hosting publik, backend, akun, pitch deck, serta validasi terhadap dataset/formulasi
dosen berada setelah MVP. Roadmap lengkap pada PLAN.md tetap menjadi arah pengembangan.

## Stack dan batas modul

- Bun 1.4.2; React 19.3; TypeScript 7 strict; Vite 8.3; Tailwind 4.3; Motion 14.
- Oxlint untuk correctness, TypeScript, hooks, dan aksesibilitas; Oxfmt untuk format.
- Dependensi dikunci oleh bun.lock; SheetJS CE 0.20.3 berasal dari CDN resmi.
- React reducer/context menyimpan state; SVG menampilkan koordinat dan route; IndexedDB menyimpan sesi.
- `domain/tsp` dan `domain/algorithms` bebas React, DOM, serta Tauri.
- Worker membungkus state machine domain dengan batching, lifecycle, dan typed messages.
- Komponen beUI gratis disalin dan diadaptasi lokal; lisensi pada THIRD_PARTY_NOTICES.md.

## Keputusan domain

Node berisi ID unik dan koordinat finite. ID input manual/impor di-trim. Koordinat berimpit valid.
Distance matrix dibentuk sekali per run; total route menambahkan edge kembali ke awal.
Route internal berupa indeks node tanpa mengulang node awal; tampilan/ekspor menyediakan rute tertutup.
Overflow jarak atau batas atas biaya seluruh tour ditolak. Kalkulasi memakai presisi penuh;
UI menampilkan tiga desimal. Epsilon 1e-9 digunakan untuk pembandingan improvement/tie.

NN memilih node terdekat, dengan ID sebagai tie-break. NI memilih node terdekat terhadap anggota tour,
lalu posisi insertion termurah dengan posisi edge sebagai tie-break. 2-OPT memakai best improvement,
mengecualikan edge bersebelahan dan reversal penuh, serta dibatasi 10.000 move.

TS mengevaluasi semua move 2-OPT dan memilih kandidat eligible terbaik. Edge yang dihapus pada
iterasi k dilarang ditambahkan kembali selama k+1 sampai k+tenure, inklusif. Aspiration berlaku ketika
kandidat mengalahkan best-so-far. Tidak ada eligible candidate menghentikan run dengan best yang tersedia.

SA memilih satu move melalui Mulberry32. Δ ≤ 0 diterima; Δ > 0 diterima jika draw < exp(−Δ/T).
Cooling geometrik dilakukan setelah jumlah iterasi per suhu. Seed dan konfigurasi yang sama
mengulang trace keputusan; durasi berbeda menurut perangkat dan kondisi browser.

Default: NN, start A, tanpa 2-OPT tambahan, TS, 2.000 iterasi, seed 42, tenure 7,
suhu awal 100, cooling rate 0,95, 20 iterasi per suhu, suhu minimum 0,001.
λ tidak ditampilkan; cooling rate disebut secara eksplisit tanpa mengasumsikan formulasi α dosen.

## Integrasi dan pengalaman penggunaan

- Draft tabel dan preview Excel terpisah dari dataset aktif sampai pengguna menerapkan data valid.
- Excel: .xlsx maksimum 10 MB, sheet dan kolom dapat dipilih; header default id/x/y; error menunjuk baris asli.
- Preview Excel menolak sheet di atas 1.001 baris data/blank; file tidak dipotong diam-diam.
- Worker menjadwalkan batch sekitar 12 ms dan progress sekitar 100 ms; state transition dapat mengirim progress segera.
- Snapshot input dan konfigurasi disimpan tiap run; move dalam trace dapat merekonstruksi kandidat/current/best.
- Pause menghentikan pencarian sampai resume; cancel menyimpan hasil parsial dan best-so-far.
- IndexedDB menyimpan skema v1; konfigurasi invalid tidak mengganti konfigurasi terakhir yang valid.
- Sesi korup atau storage gagal ditampilkan, dengan fallback memori dan tindakan eksplisit untuk menyimpan sesi baru.
- Perbandingan mengecek dataset, unit, initial route, dan budget terhadap run teratas. Evaluasi kandidat dan
  durasi selalu terlihat karena satu iterasi TS dan SA memiliki beban komputasi berbeda.
- Riwayat mengikuti browser/origin. Refresh menghentikan run belum selesai; run terminal dipersistensi.

## Verifikasi

`bun run check` menjalankan format check, lint, pengujian domain, typecheck, dan build.
`bun run test:e2e` menguji build produksi menggunakan Chrome/Edge yang terpasang.
Detail pengujian dan keterbatasan dicatat pada docs/VERIFICATION.md.
