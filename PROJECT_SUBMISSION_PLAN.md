# Rencana Penyerahan Proyek MTd Optimasi Heuristik

**Proyek:** HeuriLab — eksperimen Tabu Search dan Simulated Annealing pada TSP  
**Tenggat penyerahan:** Minggu, 18 Oktober 2026  
**Presentasi:** mulai 08.00; 15 menit per kelompok dan jeda 5 menit antar kelompok

## 1. Sasaran dan paket yang dikumpulkan

Siapkan satu paket yang konsisten dan dapat diperiksa, terdiri dari:

1. Perhitungan manual Tabu Search.
2. Laporan/file proyek dengan bagian Latar Belakang, Tinjauan Pustaka, Metodologi, Analisis dan Pembahasan, Kesimpulan, serta cara mengakses aplikasi dan menggunakan Help.
3. Coding HeuriLab beserta petunjuk menjalankannya.
4. PPT untuk presentasi 15 menit, termasuk demo singkat aplikasi.

## 2. Kondisi aplikasi dan keputusan isi

- HeuriLab web yang sekarang tetap menjadi aplikasi utama; pengembangan dilakukan pada aplikasi/repository yang sama, bukan membuat aplikasi baru.
- Fitur yang tersedia: Tabu Search dan Simulated Annealing dengan neighborhood 2-OPT; Nearest Neighbor (NN), Nearest Insertion (NI), dan Nearest Farthest Insertion (NFI) untuk rute awal; Local Search 2-OPT dan 3-OPT (sebagai kategori tersendiri maupun opsi perbaikan awal); visualisasi replay trace eksperimen; perbandingan beracuan run antarkategori.
- Fokus penjelasan dan perbandingan utama tetap TS vs SA. NN, NI, NFI, 2-OPT, dan 3-OPT berperan sebagai pembentuk solusi awal atau baseline/local search.
- Gunakan satu dataset dan satu solusi awal yang sama untuk perhitungan manual, eksperimen aplikasi, tabel hasil, dan PPT.
- Fixture enam titik yang sudah ada bersifat sintetis. Jika dosen/kelompok memiliki dataset resmi, ganti secara konsisten pada semua artefak dan simpan sumber datanya; jika tidak, beri label jelas sebagai contoh sintetis.
- Perbandingan metode mencakup baseline/konstruksi, local search, TS, dan SA dengan data yang sama. Untuk TS vs SA, samakan rute awal serta anggaran iterasi dan catat seluruh parameternya. TS/SA tetap memakai neighborhood 2-OPT.
- Cocokkan laporan lama dengan keadaan aplikasi. Saat ini jarak menggunakan Euclidean planar, impor menerima `.xlsx`, ekspor run memakai JSON, dan ekspor ringkasan perbandingan memakai CSV. Hindari klaim `.xls`/CSV sebagai format impor atau fitur yang belum tersedia.
- Pada dokumen dan antarmuka, tampilkan α sebagai cooling rate SA. Jangan menambahkan parameter λ sampai kelompok menetapkan definisi, rumus, serta rentangnya.
- Catat konfigurasi eksperimen, termasuk rute awal, tenure TS, dan parameter/seed SA. Jangan menyimpulkan satu metode selalu lebih baik dari satu contoh.

### Tahapan pengembangan pada aplikasi yang ada

1. Tambahkan NFI sebagai opsi pembentukan solusi awal di samping NN dan NI.
2. Tambahkan 3-OPT sebagai baseline/local search dan opsi perbaikan solusi awal. TS dan SA tetap memakai 2-OPT.
3. Perluas panel perbandingan agar hasil baseline/konstruksi, local search, TS, dan SA pada dataset yang sama dapat ditampilkan dan diekspor.
4. Tampilkan α di samping label cooling rate SA; λ tetap ditunda.
5. Perbarui README, metodologi, Help, dan catatan verifikasi setelah implementasi selesai. Sampai saat itu, NFI dan 3-OPT hanya berstatus rencana.

### Definisi perilaku tambahan dan verifikasi

- **Nearest Farthest Insertion:** mulai dari titik awal dan node terdekatnya; pada tiap langkah pilih node di luar tour dengan jarak minimum-ke-tour terbesar, lalu sisipkan pada edge yang memberi kenaikan biaya terkecil. Gunakan tie-break deterministik berdasarkan ID node lalu posisi edge.
- **3-OPT:** evaluasi rekoneksi valid dari tiga edge tak bersebelahan, kecualikan tour asal dan duplikat yang hanya membalik arah tour, lalu pilih perbaikan terbaik. Ulangi sampai tidak ada perbaikan atau batas iterasi local search tercapai. Jalankan di worker agar antarmuka tetap responsif.
- Uji NFI pada beberapa titik awal, determinisme, validitas tour, serta hitung biaya independen.
- Uji 3-OPT dengan kasus yang membaik dan kasus yang sudah local optimum; pastikan tour valid dan biaya tidak meningkat.
- Uji bahwa TS/SA dapat menerima rute awal yang sama, tetap reproducible sesuai algoritma/seed, serta menjaga best-so-far.
- Uji UI pemilihan NFI/3-OPT, konfigurasi α, tabel perbandingan, ekspor CSV, dan alur Help. Jalankan pemeriksaan proyek dan browser setelah implementasi kode.

## 3. Rencana kerja sampai tenggat

| Waktu              | Fokus                                                                                                                                                                                                  | Hasil yang harus siap                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Jumat, 16 Oktober  | Kunci ruang lingkup, dataset, satuan, rute awal, parameter, dan versi HeuriLab. Catat NFI/3-OPT sebagai fitur yang perlu ditambahkan; jalankan demo TS/SA yang sekarang untuk menangkap baseline awal. | Spesifikasi eksperimen; dataset final; status awal aplikasi dan baseline.                |
| Sabtu, 17 Oktober  | Implementasikan dan verifikasi NFI/3-OPT di aplikasi yang sama; perluas perbandingan, lalu selaraskan README/Help/metodologi. Selesaikan dan cek silang hitung manual TS serta laporan.                | Fitur teruji; perhitungan manual; laporan dan panduan aplikasi yang sesuai implementasi. |
| Minggu, 18 Oktober | Buat PPT dari desain Canva, latihan presentasi 15 menit, periksa konsistensi angka dan konfigurasi, lalu kumpulkan paket lengkap ke Classroom sebelum batas dosen.                                     | PPT final; laporan/perhitungan final; coding HeuriLab; checklist pengumpulan.            |

## 4. Rencana perhitungan manual Tabu Search

1. Nyatakan masalah: minimisasi total jarak tour tertutup TSP, definisi jarak Euclidean, satuan, dataset, dan titik awal.
2. Bentuk rute awal dengan metode yang sama dengan eksperimen (misalnya NN dari A); tuliskan urutan node dan jumlah jaraknya. Gunakan fixture enam node sintetis yang sama kecuali dataset resmi kelompok sudah diputuskan.
3. Jelaskan neighborhood 2-OPT yang digunakan dan enumerasi kandidat pada iterasi pertama. Tunjukkan edge yang diputus/disambung, rute kandidat, serta biaya atau delta-nya.
4. Buat tabel iterasi dengan kolom minimal: iterasi, move, kandidat terpilih, jarak kandidat, status tabu, aspiration, current solution/jarak, best-so-far/jarak, dan isi/perubahan tabu list.
5. Terapkan aturan implementasi: edge undirected yang dihapus menjadi tabu untuk ditambahkan kembali hingga tenure berakhir; pilih kandidat eligible termurah; kandidat tabu hanya lolos bila mengalahkan best-so-far; current boleh memburuk, tetapi best-so-far tidak.
6. Lanjutkan sampai batas iterasi atau alasan berhenti yang benar-benar terjadi. Jelaskan hasil akhir dan keterbatasannya; jangan memaksakan jumlah iterasi tertentu jika run selesai lebih awal.
7. Cocokkan setiap baris hitung dengan trace aplikasi dan lakukan hitung ulang total jarak dari rute akhir.

## 5. Struktur laporan

1. **Latar Belakang:** motivasi TSP, alasan metode metaheuristik, masalah/tujuan proyek HeuriLab.
2. **Tinjauan Pustaka:** TSP dan fungsi objektif; heuristik vs metaheuristik; NN/NI/NFI, 2-OPT/3-OPT; prinsip TS dan SA; tabu list/tenure/aspiration; α sebagai cooling rate; λ hanya jika kelak didefinisikan.
3. **Metodologi:** dataset dan satuan; langkah eksperimen; konstruksi solusi awal dan local search; formulasi TS/SA sesuai kode; konfigurasi; cara pengujian; cara mengakses aplikasi dan menggunakan Help.
4. **Analisis dan Pembahasan:** perhitungan manual TS; trace; hasil metode baseline dan local search; hasil TS dan SA pada kondisi sebanding; perbandingan panjang rute, improvement, iterasi, dan waktu jika tersedia; interpretasi serta batasan data sintetis.
5. **Kesimpulan:** jawaban terhadap tujuan berdasarkan hasil yang benar-benar diperoleh; keterbatasan; usulan lanjutan dipisahkan dari fitur yang sudah ada.

## 6. Urutan presentasi kelompok (15 menit)

|       Menit | Bagian                      | Isi utama                                                                 |
| ----------: | --------------------------- | ------------------------------------------------------------------------- |
|   0:00–1:00 | Pembuka                     | Nama proyek, anggota, tujuan.                                             |
|   1:00–3:00 | Latar belakang dan kasus    | TSP, representasi data, fungsi objektif, batasan kasus.                   |
|   3:00–5:00 | Metode                      | Solusi awal/2-OPT, prinsip TS dan SA, parameter utama.                    |
|   5:00–8:00 | Perhitungan manual TS       | Beberapa iterasi kunci, tabu list, aspiration, current vs best.           |
|  8:00–11:00 | Demo HeuriLab               | Input/fixture, pilih metode dan parameter, jalankan, telusuri trace/Help. |
| 11:00–13:00 | Hasil dan analisis          | Bandingkan hasil yang setara; sebutkan kondisi eksperimen dan batasan.    |
| 13:00–14:00 | Kesimpulan                  | Temuan utama dan batas klaim.                                             |
| 14:00–15:00 | Penutup/tanya jawab singkat | Ringkasan dan transisi ke kelompok berikutnya.                            |

Jeda/transisi antarkelompok: 5 menit. Dengan demikian, waktu mulai kelompok ke-`k` (urutan 1-based) adalah **08.00 + 20 × (k−1) menit**. Contoh: kelompok 1 mulai 08.00, kelompok 2 08.20, kelompok 3 08.40, kelompok 4 09.00. Nomor/urutan kelompok dan tanggal sesi presentasi belum tercantum dalam brief, jadi slot tiap kelompok perlu dicocokkan dengan urutan resmi dosen.

## 7. Urutan demo

1. Buka aplikasi dan tunjukkan Panduan/Help.
2. Muat contoh enam node atau dataset final yang disepakati; jelaskan asal data dan unit koordinat.
3. Tampilkan konstruksi rute awal dengan NN, NI, atau NFI; jalankan 2-OPT/3-OPT bila dipakai dan tampilkan rutenya.
4. Jalankan TS dengan parameter yang sama seperti contoh hitung manual; tunjukkan satu trace iterasi, tabu/aspiration, dan best-so-far.
5. Jalankan SA pada dataset, rute awal, dan budget perbandingan yang sama; sebutkan seed, α/cooling rate, dan jadwal suhu.
6. Tampilkan perbandingan baseline, local search, TS, dan SA, lalu simpulkan secara terbatas sesuai eksperimen.

## 8. Checklist sebelum mengumpulkan

- [ ] Perhitungan manual bisa dihitung ulang dan cocok dengan trace aplikasi.
- [ ] Dataset, rute awal, parameter, unit, dan angka konsisten di laporan, PPT, dan demo.
- [ ] Kelima bagian wajib laporan tersedia.
- [ ] Cara membuka aplikasi, menjalankan eksperimen, dan menemukan Help jelas.
- [ ] Kode dan instruksi menjalankan aplikasi disertakan; tidak ada secret yang ikut terkumpul.
- [ ] PPT sesuai batas 15 menit dan demo telah dicoba.
- [ ] NFI dan 3-OPT hanya dicantumkan sebagai fitur aplikasi jika implementasi dan verifikasinya sudah selesai.
- [ ] α ditampilkan sebagai cooling rate SA; λ tidak ditampilkan sebelum definisinya tersedia.
- [ ] Keempat artefak (perhitungan, laporan/file proyek, coding, PPT) diunggah ke Classroom paling lambat 18 Oktober 2026.

## 9. Referensi PPT

- Desain Canva untuk PPT proyek: https://www.canva.com/design/DAHYFX2H2c0/_3peVQq5FgyVQxW7nbZBYw/edit
- Gunakan desain ini sebagai referensi saat menyusun PPT final; periksa kembali akses dan isi desain sebelum mengedit atau mengekspor.
