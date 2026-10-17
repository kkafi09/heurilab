# Prompt Lanjutan — Perapian Riwayat dan Report HeuriLab

## 1. Tugas dan batas pekerjaan

Rapikan antarmuka HeuriLab berdasarkan dua screenshot localhost yang diberikan pengguna dan kode terbaru. Pertahankan identitas teal, kanvas, Playground/Report, stack proyek, serta alur menjalankan metode satu per satu. Fokus pada kepadatan layout, hierarki informasi, keterbacaan, konsistensi format angka, dan ketepatan makna perbandingan.

Ini adalah prompt implementasi lanjutan setelah HEURILAB_IMPROVEMENT_PROMPT.md. Verifikasi kondisi terbaru sebelum bekerja: NFI, 3-OPT, kategori hasil, dan durasi per fase sekarang sudah terdapat dalam kode. Jangan mengulang implementasi algoritma yang sudah tersedia atau menganggap daftar fitur lama pada AGENTS.md sebagai bukti bahwa fitur itu masih belum ada. Cocokkan instruksi dengan kode aktif, dokumentasikan perbedaan status, dan pertahankan semantik algoritma.

Baca panduan agen yang berlaku, periksa status Git, dan pertahankan perubahan pengguna. Ubah komponen aktif serta aturan CSS yang terkait saja. Jangan deploy, mengedit Google Docs/Canva, menghapus riwayat pengguna, atau membuat data eksperimen palsu sebagai efek samping pekerjaan ini.

## 2. Dasar analisis

### Temuan screenshot

- Playground: judul "Hasil yang Pernah Dijalankan" membungkus, sementara tindakan "Lihat Report Penuh" memakai ruang dan ukuran yang terlalu dominan di kanan judul.
- Playground: ringkasan riwayat menyebarkan informasi pada label kecil, kode `2OPT/3OPT`, nilai besar, dan badge aktif. Nama metode dan status belum menggunakan kosakata tampilan yang konsisten dengan Report.
- Report: tombol kembali bersaing dengan judul. Tombol ekspor/pembersihan berada pada baris berikutnya, membuat kartu header tinggi dan menjauhkan pengguna dari isi utama.
- Tab menggunakan label panjang, termasuk nama metode yang berubah, sehingga navigasi menyita lebar dan rentan membungkus pada layar lebih sempit.
- Panel tabel menambah lapisan padding dan memajang keterangan TS/SA di kanan judul walaupun hasil yang terlihat hanya local search.
- Jarak awal dicoret meskipun sama dengan jarak akhir, dan 0% diberi ikon penurunan berwarna hijau. Ini memberi kesan ada perbaikan padahal tidak terjadi perubahan.
- Durasi beberapa milidetik ditampilkan sebagai `0.00s`. Rincian fase menunjukkan nilai nonnol, sehingga ringkasan tampak bertentangan.
- KPI "Solusi Terbaik Global" memilih satu metode meskipun kedua hasil memiliki jarak yang sama. Label ini juga dapat dibaca sebagai klaim optimum global.
- Tabel memberi label "Acuan" pada satu hasil sementara hasil lain terlihat dipilih/aktif di kanvas. Hubungan acuan dan pilihan belum jelas.

Ruang kosong di bawah dua kartu riwayat bukan otomatis kesalahan padding. Panel mengikuti tinggi workspace dan perlu tetap dapat menampung riwayat yang lebih panjang. Jangan memenuhi ruang kosong dengan dekorasi atau meregangkan kartu.

Screenshot adalah gambar desktop, bukan pengukuran computed style. Verifikasi CSS pada browser zoom 100% dan catat viewport/DPR sebelum mengubah ukuran. Jangan menurunkan root font-size atau menggunakan CSS zoom/transform untuk membuat seluruh aplikasi tampak kecil.

### Temuan kode yang sudah diperiksa

- ControlHub.tsx merender header riwayat sebagai judul panjang dan tombol ghost dalam satu flex row. Kartu memakai kode mentah algoritma dan format persentase satu desimal.
- ReportView.tsx memiliki header flex-wrap, judul tab yang panjang, formatter durasi dengan pembulatan dua desimal detik, serta KPI minimum jarak dan minimum durasi dari seluruh `runs` tanpa pengelompokan dataset.
- Rata-rata perbaikan menggabungkan seluruh hasil nonkonstruksi, termasuk dataset/rute awal/kategori yang mungkin berbeda.
- `evaluateCondition` hanya membandingkan rute dan batas iterasi untuk pasangan metaheuristik. Pasangan local search mendapat "Dataset Sama" meskipun rute masukan mungkin berbeda.
- Kartu riwayat adalah tombol yang membungkus elemen `role="button"` untuk hapus. Pisahkan aksi interaktif agar akses keyboard dan klik tidak saling mengganggu.
- styles.css memiliki aturan khusus riwayat, header Report, tabel, dan KPI. Audit juga styling Button bersama; tombol yang proporsinya keliru bisa berasal dari aturan bersama, bukan padding halaman saja.

## 3. Layout dan hierarki visual yang dituju

### Token dan tombol

- Pertahankan font sistem proyek. Gunakan body/kontrol 14 px, teks sekunder 12 px, judul panel 16 px, dan judul halaman 20 px. Gunakan angka tabular untuk nilai metrik; angka KPI mengikuti font UI dengan ukuran 24–28 px.
- Gunakan spacing 4/8/12/16/24 px, padding kartu/panel 16 px, dan padding sel tabel 12 px. Jangan menambahkan padding luar dan dalam dengan fungsi yang sama.
- Tetapkan tombol normal setinggi 40 px dan tombol ringkas 32–36 px pada desktop. Pada layar sentuh, sediakan target minimal 44 px, termasuk tombol ikon. Ikon standar 16–18 px dan konsisten antaraksi.
- Audit varian `size="sm"` dan ghost pada Button. Label aksi sekunder tidak boleh lebih dominan daripada judul panel. Perbaiki aturan yang menyebabkan ukuran tidak sesuai tanpa mengecilkan kontrol aksesibel secara global.
- Pertahankan kontras teks dan indikator fokus. Jangan menambah override `!important` untuk menutupi konflik cascade.

### Riwayat Playground

- Ringkas header menjadi judul "Riwayat eksperimen" dan aksi sekunder "Buka Report". Hindari eyebrow yang mengulang isi judul.
- Gunakan grid dengan area judul `minmax(0, 1fr)` dan aksi `auto`. Pada panel sempit, pindahkan aksi ke baris berikutnya tanpa mendesak judul.
- Susun tiap kartu: baris pertama nama metode dan ID run, baris kedua dataset, baris ketiga jarak hasil dan status perbaikan, lalu metadata singkat basis/start/langkah serta durasi.
- Gunakan label tampilan terpusat untuk `2-OPT`, `3-OPT`, NN/NI/NFI, TS/SA. Jangan menampilkan `2OPT/3OPT` mentah ketika komponen lain memakai nama berbeda.
- Tampilkan "Ditampilkan di kanvas" hanya untuk run yang benar-benar dirender di kanvas. Jangan menggunakannya untuk menandai acuan statistik secara implisit.
- Buat tombol pilih kartu dan tombol hapus sebagai elemen saudara dalam wadah kartu. Jangan menaruh tombol/role button di dalam tombol lain. Hapus harus memiliki nama aksesibel spesifik dan tidak memicu pemilihan kartu.
- Pertahankan kartu yang ringkas dan scroll daftar bila penuh. Jangan memaksa kartu mengisi seluruh tinggi panel.

### Header dan navigasi Report

- Pisahkan navigasi kembali sebagai aksi sekunder ringkas, lalu judul "Laporan eksperimen" dan ringkasan jumlah hasil.
- Pada desktop lebar, tempatkan judul/ringkasan di kiri dan toolbar ekspor di kanan. Jika ruang tidak cukup, pindahkan toolbar sebagai satu kelompok yang teratur, bukan membungkus acak di dalam grup judul.
- Gunakan label "Ekspor JSON", "Ekspor CSV", dan "Hapus riwayat". Tunjukkan ID/nama run aktif di dekat aksi JSON agar target ekspor jelas. Pertahankan konfirmasi pembersihan riwayat yang sudah ada.
- Beri aksi destruktif bobot visual sekunder dan jarak dari ekspor. Jangan menjadikannya tindakan paling menonjol pada halaman.
- Ringkas tab menjadi "Perbandingan", "Detail & Trace", dan "Matriks jarak". Tampilkan nama metode terpilih di header konten detail, bukan pada label tab yang berubah panjang.
- Pada layar sempit, tab dapat membungkus ke baris teratur tanpa membuat halaman overflow. Pertahankan semantik tab dan operasi keyboard.

### Tabel dan KPI

- Gunakan satu judul "Perbandingan hasil" tanpa eyebrow/istilah leaderboard yang mengulang makna. Pindahkan penjelasan panjang ke catatan ringkas di bawah judul.
- Tampilkan catatan beda evaluasi TS/SA hanya ketika hasil metaheuristik relevan pada cakupan yang sedang dilihat.
- Pertahankan tabel semantik, align angka ke kanan, teks ke kiri, dan konsistensi satuan. Kolom konfigurasi memuat ringkasan; detail lengkap tersedia melalui tindakan "Detail".
- Gunakan aksi baris "Detail", "Kanvas", dan tombol hapus berlabel aksesibel. Hindari ikon tanpa penjelasan tujuan. Interaksi baris tidak boleh bergantung hanya pada klik `<tr>`.
- Bedakan hasil dipilih dengan garis/indikator teal dan latar tipis. Jangan menggunakan latar hijau kuat sebagai tanda bahwa hasil itu paling baik jika belum ada perbandingan valid.
- Gunakan grid KPI responsif empat kolom pada desktop lebar, dua pada tablet, satu pada ponsel. Header kartu boleh membungkus; badge metode tidak boleh menekan judul atau meluber.
- Pertahankan tabel lebar di dalam wadah scroll tersendiri. Tidak boleh ada overflow horizontal pada seluruh halaman.

## 4. Makna metrik dan kondisi perbandingan

Perubahan berikut memperbaiki penyajian hasil, bukan rumus algoritma atau data eksperimen.

### Angka, durasi, dan hasil tanpa perubahan

- Gunakan formatter bersama untuk riwayat, tabel, KPI, detail, dan metrik Playground. Jarak memakai locale `id-ID` dengan tiga angka desimal; persentase memakai dua angka desimal, misalnya `24,686` dan `0,00%`.
- Tampilkan durasi 0–999 ms dalam milidetik, maksimal satu desimal; durasi ≥1.000 ms dalam detik, dua desimal. Untuk nilai positif <0,1 ms, tampilkan `<0,1 ms`; nol terukur tetap `0 ms`; data yang tidak tersedia menjadi `—`.
- Gunakan nilai mentah untuk penghitungan dan peringkat. Pembulatan hanya untuk tampilan dan tidak boleh menentukan pemenang.
- Gunakan durasi total bila tersedia; pada hasil legacy, beri label waktu lama sesuai cakupan yang diketahui. Jangan menganggap fase yang tidak tercatat sebagai nol atau menyamakannya dengan durasi total terukur.
- Ganti singkatan K/P/S dengan label "Konstruksi", "Persiapan", dan "Pencarian" pada detail/tooltip yang dapat dibuka dengan keyboard. Tampilkan ringkasan fase singkat pada tabel tanpa menyembunyikan arti singkatannya.
- Jika jarak awal dan akhir sama dalam toleransi EPSILON proyek, tampilkan "Tidak berubah" atau `0,00%` dalam gaya netral. Jangan coret jarak awal atau gunakan ikon penurunan hijau.
- Jika ada perbaikan nyata, tampilkan jarak awal → akhir dan badge perbaikan. Jika perbaikannya positif tetapi membulat menjadi nol, tampilkan `<0,01%` dengan penjelasan nilai presisi di detail.
- Untuk konstruksi, persentase perbaikan tetap tidak berlaku (`—`). Pertahankan penanganan jarak awal nol yang sudah ditetapkan proyek.

### Acuan, cakupan, dan hasil seri

- Jadikan run yang dipilih di Report sebagai **acuan perbandingan** dan tampilkan `Acuan: #ID — nama metode` di atas tabel. Kartu/baris acuan dan label kondisi harus menggunakan ID yang sama. Pemilihan ini berbeda dari aksi menampilkan run di kanvas.
- Default saat membuka Report mengikuti run aktif jika valid, atau hasil terbaru. Jika acuan dihapus, pindah ke hasil terbaru yang tersisa. Jangan menyimpan acuan yang sudah tidak ada.
- Untuk dua hasil local search, tampilkan kecocokan dataset dan rute awal aktual; dataset sama saja belum membuktikan input sebanding.
- Untuk TS/SA, tampilkan dataset, rute awal, dan batas iterasi yang cocok secara eksplisit. Hindari "Kondisi Identik" yang dapat diartikan bahwa seluruh parameter TS dan SA sama; gunakan "Dataset, rute awal, dan batas iterasi sama" atau ringkasan dengan detail aksesibel.
- Ganti "Solusi Terbaik Global" menjadi "Jarak terendah pada dataset acuan". Hitung dari hasil selesai pada dataset yang sama dengan acuan, memakai key dataset/model jarak/unit yang benar; jangan mengambil nilai terkecil dari dataset lain atau hasil parsial.
- Jika beberapa hasil sama dalam EPSILON, tampilkan "Seri · N hasil" dengan daftar ID/metode pada detail. Jangan memilih 3-OPT sebagai satu-satunya pemenang hanya karena berada lebih dulu di riwayat. Nilai yang tampak sama karena pembulatan tetapi berbeda di luar EPSILON tetap dijelaskan melalui presisi detail.
- Ubah "Rata-rata Peningkatan" menjadi "Rata-rata perbaikan kelompok sebanding". Kelompok mengikuti dataset dan kategori acuan; local search juga harus memakai rute awal identik, sedangkan metaheuristik harus memakai rute awal dan batas iterasi identik. Konstruksi tidak memiliki KPI perbaikan.
- Ubah "Komputasi Tercepat" menjadi "Durasi total terendah dalam kelompok". Gunakan kelompok sebanding yang sama dan hanya hasil dengan durasi total yang benar-benar tersedia. Cantumkan ID run dan jumlah sampel; nyatakan bahwa ini durasi run teramati, bukan klaim metode selalu lebih cepat.
- Jika sampel sebanding kurang dari dua, tampilkan `—` dan keterangan "Perlu dua hasil sebanding" untuk KPI rata-rata komparatif dan durasi terendah. Jika durasi tampil sama karena pembulatan, jangan menegaskan perbedaan kecepatan yang tidak terlihat; beri keterangan bahwa tampilan waktunya setara.
- "Total eksperimen" tetap menghitung riwayat sesi dan harus diberi cakupan tersebut. Hasil parsial tetap dapat ditinjau di tabel dengan label jelas, tetapi dikecualikan dari KPI perbandingan selesai.

## 5. Pendekatan implementasi dan pengujian

1. Telusuri komponen aktif ControlHub, ReportView, Button bersama, formatter, dan aturan CSS terkait. Pastikan masalah ukuran berasal dari CSS aktual, bukan browser zoom.
2. Buat formatter serta label metode bersama; pisahkan perhitungan cakupan/acuan/KPI dari JSX agar mudah diuji. Pertahankan data mentah, skema ekspor, dan semantik algoritma.
3. Rapikan header, tab, kartu riwayat, tabel, KPI, serta akses keyboard. Gunakan token yang sudah ada jika sesuai, dengan perubahan terarah.
4. Tambahkan pengujian bermakna untuk formatter, kelompok pembanding, seri, pilihan/acuan, dan alur UI yang berubah. Jalankan `bun run check` dan `bun run test:e2e` pada browser proyek yang tersedia.
5. Tinjau screenshot pada 1920×1080, 1366×768, 768×1024, dan 390×844 pada zoom 100%; periksa reflow pada zoom 200%. Ukuran tersebut adalah viewport browser, terpisah dari chrome browser pada screenshot pengguna.

Skenario penerimaan wajib:

- Dua hasil NI → 2-OPT dan NI → 3-OPT pada fixture enam node dengan jarak sama dan 0 langkah: tidak ada coretan/ikon perbaikan palsu, hasil jarak diakui seri, durasi milidetik terbaca, dan acuan sesuai pilihan.
- Hasil dari dua dataset berbeda: KPI tidak mencampurkan jarak, persentase, atau waktu menjadi satu peringkat.
- Local search pada dataset sama tetapi rute awal berbeda: kondisi berbeda terlihat dan hasil tidak digabung dalam kelompok perbaikan sebanding.
- TS/SA pada rute awal sama dengan anggaran sama/berbeda: label kondisi tepat dan catatan evaluasi muncul sesuai konteks.
- Hasil konstruksi, parsial, legacy tanpa durasi fase, nol terukur, data durasi tidak tersedia, dan waktu kurang dari satu milidetik: tampilan benar tanpa data rekaan atau NaN/Infinity.
- Riwayat 0, 1, 2, dan 10 hasil; nama dataset/metode panjang; pemilihan run; penghapusan acuan; ekspor JSON target terpilih; ekspor CSV; serta kembali ke kanvas tetap berfungsi.
- Semua aksi ikon dapat digunakan dengan keyboard; hapus tidak memilih kartu; tab dan fokus tetap terbaca. Periksa kontras dan target sentuh.
- Header Report tidak membungkus acak, judul riwayat tidak terdesak tombol, KPI tidak overflow, dan hanya wadah tabel yang boleh scroll horizontal.

## 6. Hasil yang harus diserahkan pelaksana

Berikan ringkasan perubahan UI dan label metrik, daftar berkas yang berubah, hasil pemeriksaan beserta perintahnya, screenshot sebelum/sesudah pada viewport yang sama, serta keterbatasan yang belum terverifikasi. Bedakan temuan screenshot, hasil pengujian lokal, dan kondisi situs produksi.

Jangan menyatakan "semua rapi" hanya berdasarkan build berhasil. Tunjukkan bahwa kasus dua hasil local search pada screenshot pengguna sudah terbaca jelas, informasi perbandingannya sah, dan tampilan responsif tidak menimbulkan regresi.
