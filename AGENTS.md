# Panduan Agen — HeuriLab

Panduan ini berlaku untuk proyek HeuriLab. Ikuti juga `../AGENTS.md` bila tersedia dan `AGENTS.md` pada subfolder yang nanti ditambahkan.

## Tujuan proyek

HeuriLab adalah aplikasi pembelajaran berbasis web untuk optimasi Traveling Salesman Problem (TSP). Pertahankan aplikasi web ini sebagai produk proyek; jangan membuat aplikasi pengganti. Fokus akademik adalah menjelaskan dan membandingkan Tabu Search (TS) dengan Simulated Annealing (SA).

## Sumber kebenaran

- Instruksi tugas terbaru dosen dan brief penyerahan menentukan apa yang harus dikumpulkan.
- Kode, `README.md`, `docs/METHODOLOGY.md`, `docs/VERIFICATION.md`, dan `data/` menunjukkan perilaku aplikasi yang benar-benar tersedia.
- `PROJECT_SUBMISSION_PLAN.md` mencatat kebutuhan tugas dan rencana pengembangan. Bedakan fitur yang sudah tersedia dari fitur yang baru direncanakan.
- Dokumen laporan/brainstorming di Google Docs adalah bahan kerja; cocokkan setiap klaimnya dengan implementasi sebelum menyalin ke laporan atau PPT.
- Jika dokumen lama berbeda dari aplikasi, jangan menyatakan fitur itu tersedia. Catat sebagai batasan atau rencana lanjutan.

## Fakta implementasi yang harus dipertahankan

- Kondisi aplikasi saat ini: Pembentuk rute awal adalah Nearest Neighbor (NN), Nearest Insertion (NI), dan Nearest Farthest Insertion (NFI). Local search descent mendukung 2-OPT dan 3-OPT (tersedia sebagai kategori Local Search mandiri maupun opsi perbaikan solusi awal). TS dan SA menggunakan neighborhood 2-OPT.
- Jarak menggunakan Euclidean planar dalam unit koordinat. Jangan menyebutnya jarak jalan nyata atau jarak geografis.
- Fixture enam node di `data/example-six.json` adalah data sintetis untuk pembelajaran, bukan dataset resmi. Pada fixture itu, rute NN mulai A memiliki panjang 24.686074230319797 dan sudah optimal; perbaikan 0% pada fixture ini adalah hasil yang sah.
- Impor dataset aplikasi saat ini menerima Excel `.xlsx`; jangan menjanjikan impor `.xls` atau `.csv`. CSV adalah format ekspor ringkasan perbandingan, sedangkan JSON mengekspor detail run.
- TS memakai tabu tenure, tabu list, aspiration, kandidat eligible terbaik, dan best-so-far terpisah dari current solution.
- SA memakai seed, suhu awal, cooling rate, iterasi per suhu, dan suhu minimum. Untuk dokumen proyek, tampilkan α sebagai notasi cooling rate SA yang dipakai kelompok. Jangan menambahkan kontrol λ sebelum makna, rumus, dan rentangnya didefinisikan.
- 3-OPT diimplementasikan sebagai local search descent dan opsi perbaikan solusi awal (mengevaluasi 7 rekoneksi non-identitas deterministik). TS dan SA tetap memakai neighborhood 2-OPT.
- Tidak ada jaminan optimum global atau bahwa TS selalu mengalahkan SA. Hasil bergantung pada data, solusi awal, konfigurasi, dan seed.
- Antarmuka menyediakan Panduan/Help. Dokumentasikan akses aplikasi dan panduan dengan langkah yang sesuai UI terbaru.

## Alur kerja perubahan

1. Baca `README.md`, metodologi, verifikasi, dan modul terkait sebelum menyunting.
2. Jaga perubahan tetap terarah; jangan menimpa perubahan pengguna atau mengubah data tanpa kebutuhan tugas.
3. Untuk klaim laporan/PPT, cocokkan angka, parameter, nama kontrol, format impor/ekspor, dan batasan langsung dengan kode/dokumentasi saat ini.
4. Pertahankan stack dan perintah proyek yang dideklarasikan `package.json`; jangan menambah dependensi untuk pekerjaan dokumentasi.
5. Setelah perubahan kode, jalankan verifikasi relevan. Untuk pemeriksaan proyek menyeluruh gunakan `bun run check`; gunakan `bun run test:e2e` bila perubahan menyentuh alur browser. Jangan mengklaim verifikasi yang tidak dijalankan.

## Penyerahan mata kuliah

Brief yang diberikan untuk proyek ini meminta perhitungan manual Tabu Search, file proyek/laporan dengan Latar Belakang, Tinjauan Pustaka, Metodologi, Analisis dan Pembahasan, Kesimpulan, serta penjelasan akses aplikasi dan Help, coding, dan PPT. Tenggat yang disebutkan adalah Minggu, 18 Oktober 2026. Pastikan setiap artefak bisa ditelusuri ke aplikasi/kalkulasi yang sama.

Saat menyusun perhitungan manual, tampilkan dataset dan satuan, rute awal, biaya, neighborhood/move yang diperiksa, tabu list/tenure, aspiration bila berlaku, current dan best pada tiap iterasi, serta alasan berhenti. Terapkan tie-break dan aturan tabu yang terdokumentasi di `docs/METHODOLOGY.md` agar hasilnya dapat direproduksi.

Perubahan dokumentasi yang merencanakan NFI/3-OPT tidak berarti algoritma tersebut telah diimplementasikan. Setelah kode dikembangkan, perbarui README, metodologi, Help, dan verifikasi agar hanya menyatakan perilaku yang sudah diuji.
