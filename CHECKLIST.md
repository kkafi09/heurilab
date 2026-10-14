# HeuriLab — Implementation Checklist

Checklist ini memecah roadmap pada [PLAN.md](PLAN.md) menjadi pekerjaan yang dapat ditugaskan dan ditinjau. **P0** = wajib untuk rilis awal; **P1** = penting setelah alur inti; **P2** = peningkatan opsional. Tandai `[x]` hanya setelah acceptance criteria terpenuhi.

## Status Web MVP — 8 Oktober 2026

Implementasi awal mengikuti [MVP_PLAN.md](MVP_PLAN.md). Bukti verifikasi berada di
[docs/VERIFICATION.md](docs/VERIFICATION.md); cara penggunaan ada di [README.md](README.md).

- Rilis awal: NN, NI, 2-OPT, TS, SA; input manual/Excel, visualisasi, trace, comparison, IndexedDB, ekspor JSON/CSV.
- Dataset enam node yang ditandai selesai merupakan **contoh sintetis** yang disetujui untuk MVP.
  Dataset tugas resmi, provenance akademik, serta formulasi α/λ dosen tetap menunggu sumbernya.
- Stack: Bun, React 19, TypeScript strict, Vite 8, Tailwind 4, Motion/beUI, Oxlint, dan Oxfmt.
- Review UI/guide pada tahap ini melalui inspeksi screenshot, pengujian browser, dan walkthrough otomatis.
  Review tim/pembaca manusia dapat dilakukan setelah aplikasi dicoba.
- 3-OPT, ilustrasi akademik lengkap, pitch deck, desktop Tauri, GitHub/release publik,
  dan penerimaan seluruh deliverable tugas tetap berada pada roadmap setelah MVP.
- Milestone dokumen asli di bawah mencakup produk lengkap; status centang berlaku untuk batas MVP tersebut.

## Fase 0 — Keputusan produk dan fondasi (M0)

- [x] **P0 — Tetapkan kontrak produk dan ruang lingkup MVP**  
      **Depends on:** —  
      **Acceptance:** keputusan mencatat pengguna, alur utama, fitur MVP, bahasa UI, browser target, OS desktop, dan keluaran tugas; scope disepakati tim.
- [x] **P0 — Tetapkan definisi data dan metrik TSP**  
      **Depends on:** kontrak produk  
      **Acceptance:** tipe node/tour, aturan tour tertutup, distance model dan satuan, tie-break, presisi hitung, validasi, dan format dataset tertulis.
- [x] **P0 — Putuskan sumber dataset enam node**  
      **Depends on:** definisi data  
      **Acceptance:** dataset terpilih memiliki provenance, koordinat/matriks tidak ambigu, start node demonstrasi, dan fixture bersama. Dataset contoh pada workbook lama hanya digunakan setelah dicocokkan dengan sumber tugas.
- [ ] **P0 — Definisikan formulasi α dan λ**  
      **Depends on:** rancangan metode kelompok/referensi  
      **Acceptance:** setiap parameter memiliki metode pemilik, rumus, rentang, satuan, default, efek, dan validasi; parameter belum terdefinisi tidak muncul sebagai kontrol aktif.
- [x] **P0 — Pilih versi dan integrasi stack**  
      **Depends on:** kontrak produk  
      **Acceptance:** React, TypeScript, Vite, Tailwind, Motion/beUI, tooling build/quality, dan package manager dicatat; spike komponen berhasil tanpa mengunci seluruh UI ke API eksternal.
- [x] **P0 — Buat wireframe dan design tokens**  
      **Depends on:** stack dan alur utama  
      **Acceptance:** wireframe input/configuration, workspace visualisasi, trace, dan comparison direview; warna teal/netral, typography, spacing, status, focus, dan reduced-motion ditetapkan; kontras utama diperiksa.
- [x] **P1 — Putuskan lisensi dan atribusi beUI**  
      **Depends on:** spike komponen  
      **Acceptance:** kode salinan mematuhi lisensi/atribusi yang diwajibkan; hanya komponen yang diperlukan dipakai dan komponen Pro tidak digunakan tanpa lisensi sesuai.

**Milestone M0:** keputusan produk, domain, dataset, parameter, stack, dan wireframe siap menjadi dasar implementasi.

## Fase 1 — Fondasi project dan model domain

- [x] **P0 — Siapkan aplikasi React + TypeScript + Vite**  
      **Depends on:** M0 stack decision  
      **Acceptance:** aplikasi lokal dan production build berjalan; lint/typecheck/build scripts terdokumentasi; web tidak mensyaratkan Tauri.
- [x] **P0 — Pisahkan modul domain, fitur, dan services**  
      **Depends on:** scaffold  
      **Acceptance:** domain TSP, algoritma, UI features, worker, dan adapter terpisah; domain tidak mengimpor React, DOM, atau Tauri.
- [x] **P0 — Buat tipe dataset, node, route, config, result, dan trace**  
      **Depends on:** definisi data  
      **Acceptance:** tipe menyatakan input dan metadata run secara eksplisit; kontrak domain tidak memakai `any`; asumsi terdokumentasi.
- [x] **P0 — Implementasikan validasi dataset dan rute**  
      **Depends on:** tipe domain  
      **Acceptance:** validasi menolak ID duplikat, koordinat invalid, node terlalu sedikit, node hilang/berulang, dan rute tidak tertutup bila disyaratkan; error menunjuk field/node.
- [x] **P0 — Implementasikan matriks jarak dan `routeCost` tunggal**  
      **Depends on:** dataset kanonik  
      **Acceptance:** diagonal nol, simetri untuk Euclidean, edge/total dapat diaudit, biaya tidak dibulatkan sebelum tampilan, dan hitungan cocok dengan fixture independen.
- [x] **P0 — Tambahkan fixture dataset enam node**  
      **Depends on:** keputusan sumber dataset  
      **Acceptance:** semua metode memakai fixture yang sama; koordinat, satuan, distance model, dan expected route cost dicatat.

**Gate M1:** data valid dan hitungan rute konsisten pada fixture yang sama.

## Fase 2 — Constructive dan local-search baselines (M1)

- [x] **P0 — Implementasikan Nearest Neighbor**  
      **Depends on:** route model dan distance function  
      **Acceptance:** start node dapat ditentukan; tiap langkah memilih node belum dikunjungi terdekat dengan tie-break deterministic; tour valid dan tertutup.
- [x] **P0 — Implementasikan Nearest Insertion**  
      **Depends on:** route model dan distance function  
      **Acceptance:** pemilihan node serta posisi insertion mengikuti definisi tertulis; tie-break deterministic; tour valid; kenaikan biaya insertion benar.
- [x] **P0 — Implementasikan generator move 2-OPT**  
      **Depends on:** route model  
      **Acceptance:** kandidat invalid/duplikat dan reversal tak bermakna dikecualikan; kandidat tour valid; delta cost cocok dengan perhitungan ulang.
- [x] **P0 — Implementasikan 2-OPT descent**  
      **Depends on:** generator 2-OPT  
      **Acceptance:** strategi first/best improvement dipilih eksplisit; berhenti saat tidak ada perbaikan atau batas tercapai; final cost tidak lebih besar dari initial.
- [ ] **P1 — Implementasikan 3-OPT**  
      **Depends on:** 2-OPT dan keputusan variasi move 3-OPT  
      **Acceptance:** rekoneksi valid tanpa duplikasi; pola move yang dinyatakan tercakup; strategi improvement dan batas komputasi terlihat.
- [x] **P0 — Sajikan baseline sebagai pilihan initial solution**  
      **Depends on:** NN, NI, 2-OPT; 3-OPT setelah tersedia  
      **Acceptance:** pengguna memilih NN/NI dan opsi improvement; constructive method dan local-search method tersimpan terpisah.
- [x] **P0 — Verifikasi baseline pada kasus kecil**  
      **Depends on:** baseline selesai  
      **Acceptance:** route invariants dan brute-force oracle pada fixture kecil memverifikasi validitas dan optimum; kasus enam node ditinjau independen.

## Fase 3 — Metaheuristik inti (M2)

- [x] **P0 — Definisikan dan implementasikan Tabu Search**  
      **Depends on:** 2-OPT neighbor dan initial-solution pipeline  
      **Acceptance:** current/best terpisah; ada neighborhood, objective, tabu attributes/list, tenure, aspiration (move tabu boleh dipilih jika mengalahkan best-so-far), dan stopping condition; keputusan terekam.
- [x] **P0 — Verifikasi tabu list dan tenure**  
      **Depends on:** Tabu Search  
      **Acceptance:** masa aktif mengikuti tenure tanpa off-by-one; aspiration mengizinkan kandidat tabu yang memenuhi syarat; current cost dapat naik sementara best cost tidak.
- [x] **P0 — Definisikan dan implementasikan Simulated Annealing**  
      **Depends on:** neighbor generator dan definisi parameter  
      **Acceptance:** menerima Δ ≤ 0; peluang untuk Δ > 0 mengikuti `exp(-Δ/T)`; cooling schedule, iterasi per suhu, stopping condition, dan update best-so-far eksplisit.
- [x] **P0 — Tambahkan random generator ber-seed**  
      **Depends on:** SA  
      **Acceptance:** seed dan input sama menghasilkan hasil/trace sama; seed dicatat di setiap run.
- [x] **P0 — Implementasikan trace terstruktur**  
      **Depends on:** aturan TS dan SA  
      **Acceptance:** record memuat iterasi, candidate/current/best cost, route/move, accepted/rejected, alasan tabu/aspiration atau temperatur/probability, dan durasi yang diperlukan.
- [x] **P0 — Definisikan cancel/no-eligible/batas run**  
      **Depends on:** lifecycle run  
      **Acceptance:** kondisi berakhir dengan status jelas; trace/best-so-far tetap tersedia; run baru dapat dimulai.
- [x] **P0 — Bandingkan TS dan SA pada fixture yang sama**  
      **Depends on:** algoritma inti  
      **Acceptance:** initial route, cost function, seed, parameter, iterasi, dataset tersimpan; kondisi awal berbeda diberi label; hasil dapat diulang.
- [ ] **P1 — Buat ilustrasi TS enam node, tiga iterasi**  
      **Depends on:** trace TS tervalidasi  
      **Acceptance:** visual memuat initial route, beberapa kandidat, tabu list, keputusan/aspiration, current dan best route/cost; angka cocok dengan engine.

## Fase 4 — Web MVP dan pengalaman pengguna (M3)

- [x] **P0 — Bangun app shell dan navigasi**  
      **Depends on:** wireframe/design tokens  
      **Acceptance:** workspace dataset, konfigurasi, hasil/trace, comparison, bantuan mudah ditemukan; layout mengikuti breakpoint yang ditetapkan.
- [x] **P0 — Buat input manual node/koordinat**  
      **Depends on:** validasi domain  
      **Acceptance:** tambah/edit/hapus node, validasi inline, reset ke contoh, dan konfirmasi penerapan dataset; peta mencerminkan data aktif.
- [x] **P0 — Buat impor Excel dengan preview**  
      **Depends on:** format template dan input manual  
      **Acceptance:** format terdokumentasi; file dapat dipilih dan sheet/kolom dipetakan; baris bermasalah terlihat; dataset berubah hanya setelah konfirmasi.
- [x] **P0 — Bangun panel initial solution dan parameter**  
      **Depends on:** baseline serta kontrak parameter  
      **Acceptance:** kontrol menyesuaikan metode; nilai invalid beralasan; α/λ hanya tampil saat relevan; seed dan budget jelas.
- [x] **P0 — Bangun visualisasi node dan route**  
      **Depends on:** model domain  
      **Acceptance:** node berlabel; edge benar; initial/current/candidate/best dibedakan; legenda jelas; visual tidak mengubah perhitungan jarak.
- [x] **P0 — Jalankan algoritma di Web Worker**  
      **Depends on:** run protocol dan engine  
      **Acceptance:** typed progress messages; UI tetap responsif; cancel berfungsi; worker error tampil dan worker dibersihkan.
- [x] **P0 — Bangun hasil dan trace viewer**  
      **Depends on:** trace contract dan visualisasi  
      **Acceptance:** best route/distance, improvement, iteration, waktu, status, dan detail step cocok dengan engine; loading/empty/error/cancel tersedia.
- [x] **P0 — Bangun comparison view**  
      **Depends on:** run history/session model  
      **Acceptance:** tabel minimal TS vs SA menampilkan kondisi/parameter/initial solution, cost, iteration, runtime, seed, final route; kondisi yang berbeda dilabeli.
- [x] **P1 — Tambahkan ekspor hasil dan trace**  
      **Depends on:** skema ekspor  
      **Acceptance:** file berisi metadata dataset, konfigurasi, seed, ringkasan, dan trace pilihan; data dapat dibaca kembali.
- [x] **P0 — Terapkan beUI motion dan aksesibilitas**  
      **Depends on:** spike beUI dan komponen UI  
      **Acceptance:** transisi selektif; reduced-motion dihormati; animasi tidak menutupi status; keyboard/focus/label/kontras berfungsi.
- [x] **P1 — Simpan dan pulihkan sesi lokal**  
      **Depends on:** model state dataset/run  
      **Acceptance:** dataset/konfigurasi dipulihkan; schema terversi; data invalid ditangani tanpa crash.

**Gate M3:** alur web input → initial solution → TS/SA → visualisasi → comparison berjalan pada dataset yang sama tanpa UI membeku.

## Fase 5 — Quality, dokumentasi, dan presentasi (M4)

- [x] **P0 — Lengkapi verifikasi algoritma**  
      **Depends on:** M1–M3  
      **Acceptance:** invariants rute, cost recomputation, brute-force tiny oracle, reproducibility seed, aturan aspiration/tabu, acceptance/cooling SA dinyatakan lulus.
- [x] **P0 — Lengkapi verifikasi UX**  
      **Depends on:** web MVP  
      **Acceptance:** keyboard, focus, kontras, reduced-motion, error/loading/empty/cancel, responsivitas, dan run panjang diverifikasi.
- [ ] **P0 — Tulis methodology/theory docs**  
      **Depends on:** rancangan algoritma final  
      **Acceptance:** NN, NI, 2-OPT, 3-OPT, TS, SA, objective, formula, parameter, asumsi, dan keterbatasan sesuai implementasi.
- [x] **P0 — Tulis README dan User Guide/How to Operate**  
      **Depends on:** UI stabil  
      **Acceptance:** langkah buka aplikasi, manual/import Excel, initial solution/algoritma, parameter, run, visualisasi, comparison, troubleshooting diuji pembaca lain.
- [ ] **P0 — Siapkan demo aplikasi**  
      **Depends on:** guide dan fixture final  
      **Acceptance:** skenario dapat diulang: input/import enam node → NN → TS → trace → SA → comparison; hasil dan durasi aktual.
- [ ] **P0 — Siapkan pitch deck**  
      **Depends on:** hasil tervalidasi  
      **Acceptance:** cover, latar/problem, case/data, constructive/local search, teori TS dan ilustrasi 6 node, SA, UI, comparison, hasil, kesimpulan; angka sesuai run aplikasi.
- [ ] **P1 — Siapkan media cadangan demo**  
      **Depends on:** demo final  
      **Acceptance:** screenshot/rekaman atau data cadangan tersedia tanpa menggantikan klaim hasil aktual.

## Fase 6 — Tauri desktop dan rilis (M5)

- [ ] **P0 — Tambahkan shell Tauri pada web app stabil**  
      **Depends on:** M3 web build dan pilihan OS  
      **Acceptance:** app terbuka pada desktop window; domain/algoritma tetap shared; web tetap dapat berjalan mandiri.
- [ ] **P0 — Implementasikan adapter file dan storage**  
      **Depends on:** shell dan format impor/ekspor  
      **Acceptance:** open/save dialog dan lokasi simpan menggunakan adapter; web fallback berfungsi; izin file dibatasi.
- [ ] **P0 — Audit capabilities Tauri**  
      **Depends on:** integrasi native  
      **Acceptance:** hanya permission yang diperlukan aktif; tidak ada secret di source; plugin native dan dependensi dicatat.
- [ ] **P0 — Build dan smoke-test OS target**  
      **Depends on:** packaging config  
      **Acceptance:** package dapat dibangun/dijalankan; start, input, run, cancel, export, persistensi diuji; versi/langkah build tercatat.
- [ ] **P0 — Siapkan GitHub repository dan release notes**  
      **Depends on:** quality gates dan packaging  
      **Acceptance:** struktur repo bersih, README/setup, lisensi, atribusi data, known limitations, dan tag/version tersedia.
- [ ] **P1 — Siapkan artefak OS tambahan**  
      **Depends on:** satu OS lulus  
      **Acceptance:** tiap OS memiliki build environment, smoke test, dan petunjuk distribusi sendiri.

## Fase 7 — Final review dan serah terima

- [ ] **P0 — Lakukan acceptance walkthrough tugas**  
      **Depends on:** M4 dan M5  
      **Acceptance:** checklist tugas dipetakan ke app, repository, guide, demo, dan deck; setiap requirement punya bukti atau keterbatasan tercatat.
- [ ] **P0 — Verifikasi konsistensi seluruh artefak**  
      **Depends on:** deliverables final  
      **Acceptance:** dataset, unit, metode, parameter, route, cost, screenshot, tabel, dan kesimpulan konsisten pada app, docs, deck, demo.
- [ ] **P0 — Catat known limitations dan langkah berikutnya**  
      **Depends on:** walkthrough  
      **Acceptance:** keterbatasan performa/ukuran data/OS/algoritma dan prioritas pengembangan tercatat tanpa klaim berlebihan.

## Ringkasan Dependensi

```text
M0 Keputusan & desain
  → M1 Dataset, domain, baseline
    → M2 Tabu Search & Simulated Annealing
      → M3 Web MVP, visualisasi, comparison
        → M4 Dokumentasi, demo, pitch deck
          → M5 Tauri, packaging, release
            → Final review & handover
```

## Definition of Done

- Acceptance criteria task diverifikasi dan perubahan berada pada modul yang tepat.
- Asumsi, parameter, dan keterbatasan yang memengaruhi hasil terdokumentasi.
- Berkas sinkron proyek di `sources/` tidak diubah.
- Quality gate milestone lulus sebelum milestone ditandai selesai.
