# HeuriLab — Product & Technical Plan

> **Status:** Draft rencana implementasi  
> **Produk:** HeuriLab, aplikasi pembelajaran dan eksperimen optimasi Traveling Salesman Problem (TSP)  
> **Arah platform:** Web-first dengan React + TypeScript + Vite; desktop menyusul melalui Tauri.

## 1. Ringkasan Produk

HeuriLab membantu mahasiswa memasukkan satu dataset TSP, membentuk solusi awal, menjalankan heuristik, melihat perubahan rute, lalu membandingkan hasil. Fokus pembahasan adalah **Tabu Search (TS)** dan **Simulated Annealing (SA)**. Nearest Neighbor, Nearest Insertion, 2-OPT, dan 3-OPT menjadi pembentuk solusi awal serta baseline.

Pengguna dapat mengubah metode dan parameter (termasuk α dan λ bila memang dipakai oleh formulasi yang dipilih), menjalankan ulang eksperimen pada dataset yang sama, serta menelusuri alasan solusi dipilih atau ditolak. Keluaran tugas: GitHub repository, aplikasi web/desktop, pitch deck, demo, dan panduan operasi.

## 2. Tujuan dan Batasan

### Tujuan

- Menyediakan alur **Input data → solusi awal → optimasi → visualisasi → perbandingan**.
- Membuat perhitungan rute dan parameter cukup transparan untuk demonstrasi akademik.
- Memastikan semua metode memakai node, koordinat, aturan jarak, serta titik awal yang sama saat dibandingkan.
- Menghasilkan web app yang dapat dipaketkan sebagai desktop app melalui Tauri.

### Di luar rilis awal

- Backend, akun, sinkronisasi cloud, dan kolaborasi multi-pengguna.
- Klaim bahwa satu heuristik selalu lebih baik; hasil bergantung pada data, seed, dan parameter.
- Jaminan solusi optimal untuk dataset besar. Heuristik menghasilkan solusi layak/pendekatan, kecuali kasus kecil yang diverifikasi terpisah.

## 3. Pengguna dan Alur Utama

Pengguna utama adalah mahasiswa dan pengajar yang perlu memahami serta mempresentasikan metode optimasi.

1. Buka workspace dan pilih dataset contoh 6 node atau buat dataset.
2. Masukkan node manual atau impor Excel; validasi nama dan koordinat.
3. Periksa visualisasi node dan kebijakan perhitungan jarak.
4. Pilih solusi awal: Nearest Neighbor atau Nearest Insertion; opsional perbaiki dengan 2-OPT/3-OPT.
5. Pilih Tabu Search atau Simulated Annealing; atur parameter, seed, dan batas iterasi.
6. Jalankan, telusuri trace iterasi, lalu batalkan jika diperlukan.
7. Simpan run dalam sesi, ulangi dengan algoritma lain dengan kondisi sebanding, dan bandingkan.
8. Ekspor hasil untuk laporan/presentasi dan ikuti panduan operasi.

## 4. Ruang Lingkup Fungsional

### Data dan jarak

- Dataset memiliki ID/nama unik dan koordinat numerik `(x, y)` untuk setiap node.
- Satu dataset enam kota yang sama dipakai seluruh metode untuk demonstrasi/perbandingan.
- Default jarak adalah Euclidean pada koordinat planar; jika tugas menyediakan matriks jarak resmi, gunakan matriks itu sebagai sumber kebenaran dan dokumentasikan satuannya.
- Tampilkan matriks jarak simetris, rute tertutup (node awal muncul kembali di akhir), dan total jarak.
- Validasi: minimal tiga node, koordinat finite, ID unik, tiap node tepat sekali sebelum penutupan, tanpa edge diagonal.
- Impor Excel: template/kolom terdokumentasi, pratinjau, pesan error per baris, dan data aktif tidak berubah sebelum pengguna menerapkan impor.

### Metode

| Metode | Peran | Perilaku minimum |
|---|---|---|
| Nearest Neighbor (NN) | Solusi awal/baseline | Mulai dari node pilihan; pilih node belum dikunjungi terdekat; tutup tour. |
| Nearest Insertion (NI) | Solusi awal/baseline | Mulai dari tour kecil; pilih node terdekat terhadap tour; sisipkan pada posisi dengan kenaikan biaya terkecil. |
| 2-OPT | Local search/baseline | Uji pembalikan segmen valid; hitung delta cost; terima perbaikan sesuai strategi; berhenti saat tidak ada perbaikan/batas tercapai. |
| 3-OPT | Local search/baseline lanjutan | Evaluasi rekonstruksi 3-edge valid; definisikan move dan stopping rule; batasi komputasi untuk data besar. |
| Tabu Search | Metode inti | Neighborhood (rilis awal: 2-OPT), pemilihan kandidat eligible terbaik, tabu attributes/list, tenure, aspiration bila kandidat tabu mengalahkan best-so-far, best terpisah dari current, dan stopping condition. |
| Simulated Annealing | Metode inti | Neighborhood (rilis awal: 2-OPT), Δcost, penerimaan probabilistik `exp(-Δ/T)` untuk Δ positif, initial temperature, cooling schedule/rate, iterasi per suhu, best solution, dan kondisi berhenti. |

Parameter tervalidasi dan terlihat: iterasi maksimum, seed, metode solusi awal, neighborhood, tabu tenure dan aturan aspiration (TS), initial temperature, cooling rate/α dan iterasi per suhu (SA). **α dan λ bukan parameter universal**: tampilkan hanya pada metode/formulasi yang mendefinisikan makna, satuan/rentang, default, dan validasinya. Hindari kontrol untuk parameter tanpa definisi akademik.

### Hasil dan visualisasi

- Kanvas node dan tour; warna konsisten bagi initial, current/candidate, dan best route.
- Ringkasan: best route, best distance, improvement atas initial, iterasi, durasi, seed, konfigurasi.
- Trace: iteration, candidate/current/best cost, move, tabu status, aspiration, temperatur/acceptance (SA), serta alasan menerima/menolak.
- Tabel perbandingan run: metode, initial solution, best distance, improvement, iterasi, waktu, parameter, seed, final route.
- Satuan jarak, timer, status, empty/loading/error state, dan keterbatasan hasil jelas.
- Demo 6 node dapat menampilkan tiga iterasi awal TS langkah demi langkah; jelaskan bahwa ilustrasi itu bukan keseluruhan perilaku algoritma.

## 5. Prinsip Algoritma dan Reproducibility

- Kontrak algoritma bebas UI: menerima dataset/config/seed dan mengembalikan hasil serta trace terstruktur.
- Satu definisi `routeCost`, normalisasi rute, dan tie-breaking untuk semua metode.
- Gunakan seeded random number generator untuk SA dan catat konfigurasi lengkap tiap run.
- Jangan membandingkan run dari dataset, metrik jarak, kondisi awal, atau budget berbeda tanpa label yang jelas.
- Pisahkan **current solution** dari **best-so-far**. TS boleh bergerak ke solusi lebih buruk jika kandidat eligible terbaik demikian; best-so-far tidak memburuk.
- SA menerima perbaikan langsung dan solusi lebih buruk secara probabilistik sesuai suhu; best-so-far hanya berubah jika membaik.
- Simpan presisi penuh dalam kalkulasi; pembulatan hanya untuk tampilan.
- Tetapkan behavior saat kandidat eligible tidak ada, 3-OPT terlalu mahal, dan pengguna membatalkan run.

## 6. Arsitektur Web-first dan Tauri-ready

### Stack

- React + TypeScript + Vite untuk SPA web.
- beUI untuk komponen animasi terpilih yang disalin dan disesuaikan. beUI berbasis React, Tailwind CSS 4, dan Motion; pastikan kompatibilitas versi/dependensi pada fase setup. Bungkus komponen dalam design system lokal. [Dokumentasi beUI](https://beui.dev/)
- Tailwind CSS 4 untuk styling bila kompatibel; token warna dan komponen visual tetap milik aplikasi.
- Tambahkan Tauri setelah alur web stabil; akses filesystem/dialog melalui adapter dan kapabilitas minimal.
- Penyimpanan awal di browser; abstraksi storage memungkinkan perpindahan ke filesystem lokal desktop.

### Batas modul

```text
src/
  app/                  routing, shell, providers
  features/             dataset, experiment, comparison
  components/           UI bersama dan wrapper beUI lokal
  design-system/        tokens, typography, motion, primitives
  domain/tsp/           types, distance, route validation/cost
  domain/algorithms/    NN, NI, 2-OPT, 3-OPT, TS, SA
  services/              worker, import/export, storage adapters
  workers/               pekerjaan optimasi panjang
src-tauri/               shell, capabilities, icons, packaging
docs/                    methodology, user guide, demo notes
data/                    dataset contoh/template terdokumentasi
```

Domain/algoritma tidak mengimpor React, DOM, atau Tauri. Run panjang ditempatkan pada Web Worker agar UI responsif; pesan bertipe mencakup start/progress/pause/cancel/completed/error. UI mengatur state dan memvisualisasikan hasil.

### Transisi ke desktop

1. Bangun aplikasi sebagai web SPA; fitur inti tidak memerlukan API native.
2. Hindari ketergantungan pada server runtime atau akses browser yang tidak tersedia dalam WebView.
3. Tambahkan shell Tauri, file dialog, impor/ekspor, dan penyimpanan melalui adapter.
4. Batasi permission/capabilities pada kebutuhan nyata; build dan smoke-test pada OS target.

## 7. Arah UI dan Motion

- Modern, minimalis, tenang, berorientasi data; desktop-first pada kanvas eksperimen dan responsif untuk layar kecil.
- Palet teal dengan latar netral hangat/putih, teks charcoal, warna status berkontras memadai. Token awal: teal-700 untuk aksi, teal-50 untuk highlight, slate/stone untuk surface, amber untuk warning, merah untuk error. Finalisasi melalui pemeriksaan kontras.
- Layout: header produk; panel input/konfigurasi; kanvas visualisasi rute; ringkasan; tab Trace dan Comparison.
- Gunakan beUI untuk transisi state, tab/accordion/drawer/toast/loading dan angka hasil yang sesuai. Motion singkat dan tidak menghambat; ikuti `prefers-reduced-motion`; jangan animasikan setiap node/iterasi tanpa kontrol.
- Typography sederhana, hierarki dan whitespace jelas, ikon bermakna, fokus keyboard terlihat, label form, pesan validasi dekat input.
- Batasi update progress dengan throttle/batch; animasi step-by-step dapat diputar, dijeda, atau dimatikan.

## 8. Quality Gates

1. **Model/data:** validasi input, matriks jarak, penutupan rute, dan route cost konsisten pada fixture yang sama.
2. **Algoritma:** invariants rute selalu benar; trace dapat dihitung ulang; kasus kecil dibanding brute-force oracle; seed menghasilkan SA reproducible.
3. **Integrasi:** semua metode menggunakan dataset/cost function sama; UI menampilkan parameter/seed yang benar; cancel/error tidak meninggalkan run menggantung.
4. **UX/a11y:** alur keyboard, kontras, reduced motion, dan empty/loading/error state diverifikasi.
5. **Kinerja:** run tidak membekukan UI; progress dibatasi; data besar memiliki batas dan pesan jelas.
6. **Rilis:** production web build bersih; browser target smoke-tested; Tauri build/package dan jalur file diuji di OS target; dokumentasi sesuai hasil aktual.

## 9. Roadmap

| Milestone | Hasil | Syarat selesai |
|---|---|---|
| M0 — Fondasi & desain | keputusan arsitektur, token teal/netral, wireframe, kontrak domain | versi stack/beUI terpilih; dataset, metrik, α/λ didefinisikan; scope disepakati. |
| M1 — Data & baseline | dataset kanonik, distance matrix, NN/NI/2-OPT/3-OPT | baseline valid pada dataset yang sama; rute/cost dapat diverifikasi. |
| M2 — Metode inti | TS dan SA dengan parameter, seed, trace | acceptance rules, current/best, stopping, trace tervalidasi. |
| M3 — Web MVP | manual/Excel input, konfigurasi, rute, hasil, comparison | alur web ujung ke ujung berjalan tanpa UI membeku. |
| M4 — Demo & dokumentasi | demo 6 node/3 iterasi TS, user guide, methodology, deck | instruksi dapat diikuti; angka/visual cocok dengan aplikasi. |
| M5 — Desktop & rilis | Tauri, file workflows, installer/package, repository release | build dan smoke test OS target; permission minimal; dokumentasi rilis siap. |

## 10. Risiko dan Keputusan Terbuka

- **Jarak/dataset:** konfirmasi asal koordinat/matriks, satuan, dan apakah pembulatan workbook hanya untuk display; tetapkan provenance dataset kanonik.
- **Definisi α/λ:** tulis rumus dan metode pemilik dari rancangan kelompok/dosen; jangan menyamakan cooling rate dengan α bila definisinya berbeda.
- **3-OPT:** kandidat tumbuh cepat; tetapkan first/best improvement dan batas ukuran/iterasi.
- **Impor Excel:** tetapkan format sheet dan kolom yang didukung.
- **beUI compatibility:** konfirmasi React 19/Tailwind 4/Motion serta dependensi tiap komponen terhadap stack; siapkan wrapper dan reduced-motion fallback.
- **Tauri target:** pilih OS dan format distribusi; uji akses file, path, dan build environment sebelum milestone desktop.
- **Perbandingan adil:** catat dataset, start node, distance model, budget, seed, dan seluruh parameter.

## 11. Dokumen Rujukan

- Google Doc tugas: [Brainstorming Optimasi Metaheuristic](https://docs.google.com/document/d/1N5VJwPCoNYN6tAPPstYB3QcK5kYELL1Z3tyn9_xJNa4/edit)
- Berkas rujukan lokal: `sources/8481-32033-1-PB Contoh Paper TSP SA dan BB.pdf`, `sources/final_report TS.pdf`, `sources/Talbi_Metaheuristics- From Design to Implementation.pdf`, `sources/TS_tutorial.pdf`, dan `sources/TSP_nearest neighbour farthest insertion.pptx`.
- Prioritas/deliverable mengikuti tugas: dataset konsisten, NN/NI, 2-OPT/3-OPT, Tabu Search, Simulated Annealing, visualisasi/perbandingan, repository, aplikasi, pitch deck, demo, dan user guide.
