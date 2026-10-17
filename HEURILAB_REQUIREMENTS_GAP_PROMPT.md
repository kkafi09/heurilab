# Prompt Lanjutan — Tutup Gap Kebutuhan dan Ketepatan Hasil HeuriLab

## 1. Mandat dan keadaan awal

Audit dan perbaiki gap yang tersisa pada aplikasi HeuriLab berdasarkan brief proyek TSP, kode terbaru, dan temuan di bawah. Pertahankan aplikasi, React/TypeScript/Vite/Bun, identitas teal, Playground/Report, serta eksekusi metode satu per satu. Fokus utama akademik tetap Tabu Search (TS) dibandingkan Simulated Annealing (SA); NN/NI/NFI dan 2-OPT/3-OPT merupakan konstruksi serta baseline/local search.

Dokumen ini disusun dari pemeriksaan kode lokal pada 17 Oktober 2026. Saat audit terdapat perubahan pengguna pada engine, ControlHub, ReportView, stylesheet, pengujian, catatan verifikasi, serta formatter baru. Periksa ulang status Git dan isi modul sebelum mengedit. Jangan reset, menimpa, atau menganggap perubahan tersebut sebagai pekerjaan yang harus dibuang. Ikuti panduan agen yang berlaku, lalu cocokkan status fitur terhadap kode aktual; sebagian deskripsi status pada AGENTS.md masih tertinggal.

Yang sudah tersedia dan harus dipertahankan: NN/NI/NFI, local search 2-OPT/3-OPT, konfigurasi perbaikan awal, TS/SA dengan neighborhood 2-OPT, kontrol α/suhu minimum SA, kategori hasil, perbandingan beracuan, formatter ms/s, deteksi hasil seri, ekspor, migrasi sesi v1/v2, Help, serta pemisahan aksi pilih/hapus riwayat. Jangan meminta implementasi ulang fitur-fitur tersebut.

Brief meminta dataset konsisten, parameter yang dapat diubah, hasil rute/jarak/iterasi/waktu, visualisasi termasuk initial/candidate/best TS, perbandingan TS–SA, repository, aplikasi, panduan, demo, PPT, serta perhitungan manual sesuai instruksi pengumpulan. λ hanya diperlukan jika digunakan dalam formulasi kelompok; jangan mengarang parameter baru untuk memenuhi nama simbol.

Laksanakan prioritas P1 sebelum pemolesan tambahan. Temuan statis dan probe fungsi di dokumen ini bukan bukti pengujian browser atau deployment terbaru.

## 2. P1 — Ketepatan waktu di ekspor dan perbandingan

### G1. Kolom total waktu CSV salah sumber

**Bukti:** `src/services/export.ts` mendeklarasikan kolom `total_duration_ms` tetapi mengisinya dengan `run.durationMs` (sekitar baris 54 dan 84), yang pada hasil local search/metaheuristik merupakan waktu pencarian. Worker menyimpan total di `run.durations.totalMs`.

**Probe fungsi yang sudah dijalankan:** untuk construction=2 ms, preparation=3 ms, search=15 ms, dan total=20 ms, CSV mengekspor `total_duration_ms` bernilai **15**, bukan 20.

**Perbaikan:**

- Ekspor total dari durasi total yang benar. Pertahankan waktu pencarian pada kolom pencarian dan presisi mentah.
- Pada hasil legacy tanpa total terukur, kosongkan kolom total; jangan mengubah `durationMs` lama menjadi total tanpa bukti. Bila perlu, tambahkan kolom waktu legacy dan cakupannya tanpa merusak kolom yang sudah dipakai.
- Pastikan ekspor JSON, CSV, tabel, dan detail sepakat mengenai arti setiap durasi. Kolom tidak relevan pada konstruksi, seperti perbaikan persen, jangan diisi angka nol yang menyatakan ada baseline perbaikan.

**Penerimaan:** fixture 2+3+15 menghasilkan total 20; hasil legacy tidak menghasilkan total rekaan; konstruksi/local search/TS/SA serta hasil parsial memiliki kolom yang sesuai.

### G2. KPI total mencampurkan waktu legacy dan pipeline berbeda

**Bukti:** `src/features/report/formatters.ts` memakai `durations?.totalMs ?? durationMs` untuk tampilan total dan kelompok durasi tercepat. `src/workers/optimizer.ts` membangun ulang rute untuk run pertama, tetapi run pembanding TS–SA dapat memakai snapshot rute yang sudah jadi tanpa mengulang konstruksi/persiapan.

**Probe fungsi yang sudah dijalankan:** run baru dengan total 20 ms digabung dengan run legacy `durationMs=1` tanpa breakdown; KPI mengumumkan **1 ms** sebagai durasi total terendah dari dua hasil sebanding.

**Perbaikan:**

- Bedakan durasi pencarian, persiapan, konstruksi, dan total terukur. Waktu legacy dengan cakupan lama ditampilkan secara eksplisit dan dikecualikan dari peringkat total.
- Jadikan waktu pencarian sebagai metrik waktu utama untuk membandingkan TS–SA dari rute awal identik. Tampilkan total sebagai informasi pipeline tambahan, termasuk apakah rute awal dihitung ulang atau dipakai dari snapshot.
- Jangan membuat penyalinan snapshot seolah-olah merupakan pengukuran ulang konstruksi atau persiapan algoritma. Jangan menyalin waktu run pertama sebagai pengukuran run kedua.
- Definisikan cakupan pengukuran matriks jarak dan enumerasi neighborhood. Saat audit sebagian pekerjaan setup dilakukan di luar timer fase; jelaskan cakupan sebenarnya atau masukkan pekerjaan tersebut ke fase yang tepat, tanpa penghitungan ganda.
- Periksa pembandingan durasi seri berdasarkan presisi tampilan. Jangan mengartikan satu run yang cepat sebagai bukti suatu metode selalu lebih cepat.

**Penerimaan:** legacy tidak memenangkan KPI total; pasangan TS–SA dengan 3-OPT sebagai persiapan menunjukkan search time dan sumber rute awal secara jujur; jeda tidak menambah waktu aktif dan total konsisten dengan definisi fase.

## 3. P1 — Pembatalan persiapan dan pemulihan sesi

### G3. Hasil cancel persiapan dapat ditolak oleh parser sesi

**Bukti:** cabang `phase === "preparing"` di worker mengirim hasil kategori metaheuristik, `trace: []`, dan `iterations: lsSteps` (sekitar baris 599–632). `src/services/storage.ts` mewajibkan jumlah trace sama dengan iterasi metaheuristik (sekitar baris 145).

**Probe fungsi yang sudah dijalankan:** bentuk hasil cancel persiapan dengan satu langkah local search dan trace kosong ditolak oleh `parseSession` dengan pesan **"Trace tersimpan tidak valid."** Ini menunjukkan kontrak kedua modul tidak cocok; kejadian browser aktual masih perlu direproduksi pada dataset yang memungkinkan cancel setelah ada perbaikan.

**Perbaikan:**

- Pisahkan hitungan langkah/evaluasi persiapan dari iterasi/evaluasi pencarian TS–SA. Jika dibatalkan sebelum pencarian, hitungan pencarian nol dan trace pencarian kosong.
- Simpan metadata tahap pembatalan, rute dasar, dan rute terbaik persiapan agar UI tidak menyatakan TS/SA sudah berjalan atau menemukan perbaikan tersebut.
- Perbarui protocol, hasil, parser sesi, tampilan, dan ekspor bersama-sama. Pertahankan validasi trace untuk hasil pencarian normal; jangan menghapus invariant parser agar kasus ini lolos.
- Tangani data v2 lama yang jelas terbentuk dari pola cancel persiapan tersebut dengan migrasi terarah dan catatan asal. Jangan menebak trace yang hilang atau mengubah semua hasil cancelled menjadi kasus persiapan. Data yang tidak dapat dipastikan tetap mengikuti pemulihan sesi yang sudah ada, tanpa otomatis menimpa sumbernya.
- Validasi durasi fase yang dipulihkan: tipe numerik finite dan nonnegatif, serta hubungan fase/total sesuai format yang didukung. Jangan sekadar melakukan type assertion terhadap `item.durations`.

**Penerimaan:** persiapan 2-OPT/3-OPT yang dibatalkan sebelum dan setelah langkah perbaikan tetap dapat disimpan, dimuat ulang, ditinjau, dan diekspor. Run setelahnya berhasil. TS/SA tidak dimulai setelah persiapan dibatalkan. Sesi normal dan sesi legacy tetap valid.

## 4. P1/P2 — Visualisasi dan validitas pembanding

### G4. Trace TS belum tersambung dengan visualisasi kandidat

**Bukti:** `src/app/App.tsx` selalu mengisi `candidate: undefined` pada rute visualisasi (sekitar baris 60–75). InteractiveCanvas mendukung candidate, dan fungsi `reconstruct(run, index)` tersedia di engine, tetapi pilihan iterasi pada Report hanya disimpan dalam state lokal untuk detail teks.

**Perbaikan:**

- Sediakan tampilan replay iterasi TS/SA pada alur aktif. Saat pengguna memilih iterasi, rekonstruksi dan tampilkan initial, candidate, current, serta best dari snapshot run tersebut, beserta biaya, keputusan, tabu list/tenure, dan aspiration yang relevan.
- Gunakan komponen peta yang tersedia pada detail Report atau hubungkan pilihan trace ke kanvas dengan ID run dan indeks iterasi. Implementasikan satu alur yang jelas; jangan memperbaiki hanya komponen lama yang tidak dirender.
- Beri legend warna/pola yang membedakan layer dan tindakan kembali ke hasil akhir. Node awal harus mengikuti run yang sedang divisualisasikan, bukan konfigurasi workspace yang sudah diubah.
- Putar ulang trace tanpa mengubah dataset aktif, parameter, hasil historis, atau menjalankan ulang algoritma. Untuk run tanpa move, jelaskan alasan berhenti secara benar.

**Penerimaan:** pada minimal tiga iterasi TS, biaya candidate/current/best pada peta cocok dengan trace serta kalkulasi independen. Kandidat yang ditolak SA tetap dapat dilihat tanpa menggantikan current; keluar dari replay memulihkan hasil akhir.

### G5. Rute pada detail masih memakai indeks internal

**Bukti:** detail konstruksi/local search pada ReportView memakai `run.bestRoute.join(...)` dan `run.initialRoute.join(...)` (sekitar baris 606, 697, dan 703). Route internal menyimpan indeks, sedangkan brief/laporan memakai ID node seperti A–F.

**Perbaikan:** gunakan konversi rute tertutup berbasis snapshot dataset (`closedRoute` atau helper bersama) di semua output pengguna. Bedakan indeks posisi move dari nama kota. Jangan menggunakan dataset terkini untuk memetakan hasil historis.

**Penerimaan:** ID seperti A, Gudang-1, dan N10 tampil benar; tour kembali ke ID awal; tidak ada rute pengguna yang berubah menjadi 0 → 1 → ... karena indeks internal.

### G6. Grafik pembanding belum membatasi dataset dan state trace

**Bukti:** opsi pembanding kurva menerima semua run selain dirinya yang memiliki trace, tanpa pemeriksaan dataset/rute/budget. `selectedStep` dan state halaman tabel belum direset ketika detail berpindah ke run lain. Label nomor pada opsi dihitung dari indeks setelah filter, sehingga dapat berbeda dari nomor di riwayat campuran kategori.

**Perbaikan:**

- Default pembanding kurva adalah pasangan metaheuristik dengan dataset, rute awal, dan batas iterasi sama. Hasil yang berbeda tetap boleh dipelajari hanya dengan peringatan kondisi yang eksplisit; dataset berbeda tidak boleh ditumpuk diam-diam pada sumbu biaya yang seolah sama.
- Pertahankan pemisahan yang sekarang sudah ada antara acuan perbandingan, run detail, dan run kanvas; pastikan labelnya selalu menunjuk ID yang benar.
- Reset pilihan iterasi, pagination, dan pembanding yang tidak valid saat pindah/hapus run atau ubah dataset. Detail pendek tidak boleh membuka halaman kosong bekas trace panjang.
- Hitung label/nomor run dari koleksi asal atau ID stabil, bukan posisi daftar yang telah difilter. Terapkan label yang sama pada riwayat, dropdown, ekspor terpilih, dan tabel.

**Penerimaan:** riwayat campuran konstruksi/local search/TS/SA tidak salah memberi nomor; pindah dari halaman trace terakhir run panjang ke run pendek menampilkan halaman pertama; dataset pembanding berbeda diberi perlakuan yang jelas.

## 5. P2 — Parameter dan dokumentasi yang masih tertinggal

### G7. Validasi parameter yang tidak relevan dapat menghalangi metode lain

**Bukti statis:** `validateConfig` pada kategori metaheuristik memvalidasi seed, suhu, cooling rate, iterasi per suhu, dan suhu minimum untuk TS maupun SA; hanya tenure yang sudah dibatasi pada TS. UI menyembunyikan parameter SA saat TS dipilih.

**Perbaikan:** validasi parameter bersama untuk semua metode dan parameter khusus hanya pada metode yang memakainya. Pertahankan validasi penuh ketika SA dipilih kembali. Jangan diam-diam mengganti nilai draft pengguna agar TS lolos. Normalisasikan konfigurasi kategori konstruksi sehingga metode yang dijalankan sesuai label dan parameter tersimpan.

**Penerimaan:** pengguna mengosongkan parameter SA lalu beralih ke TS masih dapat mengatur/menjalankan TS bila parameter TS valid; kembali ke SA tetap memperlihatkan error terkait. Hasil tersimpan dan worker menggunakan metode yang sama dengan pilihan UI.

### G8. Status fitur dan spesifikasi 3-OPT bertentangan antardokumen

**Bukti:** AGENTS.md dan PROJECT_SUBMISSION_PLAN.md masih menyebut NFI/3-OPT belum tersedia. METHODOLOGY.md menjelaskan tujuh rekoneksi, worker saat audit memeriksa tujuh case, tetapi VERIFICATION.md masih menyebut empat rekoneksi pada salah satu bagian.

**Perbaikan:**

- Selaraskan status NFI/3-OPT dengan implementasi dan pengujian yang benar-benar dilakukan. Pertahankan batasan TS/SA tetap 2-OPT, data sintetis, dan λ hanya jika terdefinisi.
- Cocokkan definisi 3-OPT, jumlah case, cara enumerasi, dan arti evaluasi kandidat antara domain, worker, pengujian, Help, dan dokumen. Jangan mengubah algoritma hanya agar cocok dengan teks lama atau mengklaim jumlah kandidat unik bila yang dihitung sebenarnya evaluasi rekoneksi yang dapat berulang.
- Perbarui petunjuk UI sesuai tombol/tab terbaru dan bedakan catatan pengujian sebelumnya dari hasil pemeriksaan baru. Jumlah tes pada VERIFICATION.md harus berdasarkan perintah yang dijalankan, bukan disalin dari audit ini.
- Catat bahwa file prompt terdahulu adalah spesifikasi historis; status implementasi terbaru harus mengacu ke kode serta verifikasi, bukan mengulang seluruh daftar pekerjaan lama.

## 6. Kelengkapan akademik — pisahkan dari bug aplikasi

Saat penelusuran repository ini belum ditemukan berkas khusus hitungan manual TS, paket hasil eksperimen laporan, atau PPT final. Temuan ini terbatas pada repository; tidak membuktikan artefak di Google Docs/Canva atau lokasi lain belum ada.

Untuk menutup kebutuhan penyerahan, siapkan atau tautkan artefak yang benar-benar tersedia:

- Dataset acuan enam node sintetis yang sama, matriks jarak, rute NN mulai A, parameter, dan sumber versi kode.
- Perhitungan manual ilustratif beberapa iterasi TS: move, kandidat, biaya/delta, status tabu, aspiration, current/best, dan alasan berhenti. Cocokkan dengan trace; tidak perlu menulis seluruh kandidat 2.000 iterasi untuk ilustrasi PPT.
- Hasil NN/NI/NFI, 2-OPT/3-OPT dari rute dasar sama, serta pasangan utama TS–SA dari rute NN A tanpa perbaikan, batas 2.000 iterasi, dan konfigurasi default yang dicatat. Gunakan hasil aktual, bukan angka rekaan.
- Interpretasi fixture yang NN-nya sudah optimal dan dapat menghasilkan perbaikan 0%. Jika menambah kasus untuk menunjukkan perbaikan, perlakukan sebagai skenario tambahan konsisten; jangan mengganti fixture acuan diam-diam.
- Petunjuk akses web/lokal, Help, repository, alur demo, dan referensi PPT Canva yang sudah ada dalam rencana penyerahan.

Sediakan ringkasan kesesuaian untuk laporan/PPT. Jangan menulis ulang Google Docs atau Canva dalam pekerjaan kode ini; bila ada pekerjaan terpisah pada dokumen brainstorming, pertahankan batasan hanya tab **all**. Jangan menyatakan artefak eksternal sudah diverifikasi bila belum dibaca.

## 7. Strategi pengujian dan hasil akhir

1. Baca ulang area temuan dan reproduksi kasus pada versi terbaru. Jika sudah diperbaiki oleh perubahan pengguna, pertahankan perbaikannya dan tutup temuan dengan bukti; jangan menerapkan patch berdasarkan nomor baris lama saja.
2. Prioritaskan G1–G4, lalu G5–G8. Tambahkan pengujian regresi yang menargetkan perilaku, termasuk worker/protocol dan sesi, bukan hanya helper formatter.
3. Uji ulang domain dan browser yang relevan: `bun run check` dan `bun run test:e2e`. Gunakan dataset deterministik yang memungkinkan persiapan menghasilkan langkah sebelum dibatalkan. Hindari pengujian cancel yang lulus hanya karena proses belum sempat menghasilkan apa pun.
4. Uji invariant rute/biaya independen, kesetaraan rute TS–SA, snapshot historis, ekspor, legacy, replay, pagination, dan parameter tersembunyi. Jangan mengklaim exact equality pada durasi antar-run.
5. Periksa UI pada desktop 1366×768 dan ponsel 390×844, terutama replay, detail rute, dropdown pembanding, serta label fase. Pertahankan perbaikan responsif dan aksesibilitas yang sudah masuk.
6. Perbarui dokumentasi berdasarkan hasil aktual. Laporkan tiap gap dengan status sudah diperbaiki/belum/di luar repository, daftar perubahan, hasil perintah, bukti ekspor/replay, dan keterbatasan.

Kriteria selesai: waktu pada CSV dan UI memiliki arti yang sama; pembatalan persiapan tidak merusak pemulihan sesi; kandidat TS dapat divisualisasikan dari trace; rute tampil sebagai ID node; perbandingan tidak menyamarkan beda dataset/pipeline; serta dokumen tidak lagi menyangkal fitur yang sudah tersedia. Deployment dan perubahan artefak eksternal mengikuti otorisasi tersendiri yang berlaku.
