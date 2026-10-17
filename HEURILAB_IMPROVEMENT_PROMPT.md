# Prompt Implementasi Perbaikan UI dan Penyelesaian Fitur HeuriLab

## 1. Mandat, konteks, dan aturan kerja

Perbaiki aplikasi web HeuriLab yang sudah ada di https://heurilab.kafi.gg dengan merapikan antarmuka dan menyelesaikan fitur pembanding yang dibutuhkan proyek TSP. Implementasikan pekerjaan di repository HeuriLab yang sama. Pertahankan identitas teal, pembagian Playground/Report, bahasa Indonesia, dan stack React, TypeScript, Vite, serta Bun yang dideklarasikan dalam proyek.

Prompt ini adalah spesifikasi pekerjaan implementasi berikutnya. Keberadaan dokumen ini tidak menyatakan bahwa fitur tambahan sudah selesai dibuat atau diuji.

Sebelum mengedit:

1. Baca AGENTS.md yang berlaku, README.md, PROJECT_SUBMISSION_PLAN.md, docs/METHODOLOGY.md, docs/VERIFICATION.md, dan modul terkait.
2. Periksa status Git dan perubahan lokal. Pertahankan pekerjaan pengguna, termasuk dokumen yang belum masuk Git. Jangan melakukan reset, penghapusan, atau pemformatan menyeluruh yang menimpa perubahan lain.
3. Cocokkan temuan audit di bawah dengan kode dan situs terbaru. Gunakan `rg` untuk pencarian teks, `fd` untuk penemuan berkas bila tersedia, serta pencarian struktur bila diperlukan.
4. Telusuri komponen yang benar-benar dipasang oleh App. Saat audit, antarmuka aktif memakai ControlHub dan ReportView; mengubah ConfigPanel atau Comparison lama saja belum tentu memperbaiki alur pengguna.
5. Pertahankan dependensi yang tersedia. Jangan mengganti framework, membuat aplikasi pengganti, atau menambahkan backend/akun untuk pekerjaan ini.

Keputusan pengguna: rapikan tampilan sekarang, tanpa desain ulang menyeluruh. Metode dijalankan **satu per satu**, kemudian dibandingkan di Report; jangan menjadikan eksekusi seluruh metode sekaligus sebagai alur utama.

## 2. Dasar audit dan gap yang harus diselesaikan

### Temuan langsung pada situs

Audit percakapan dilakukan pada 17 Oktober 2026 terhadap viewport sempit sekitar 588 × 651 piksel. Temuan berikut berasal dari screenshot, struktur aksesibilitas, dan computed style situs saat audit:

- Modal Panduan dibatasi sekitar 520 px dan menggulirkan seluruh dialog. Navigasi tab melampaui area tersedia: lebar konten sekitar 524 px pada wadah sekitar 461 px, sehingga label tab terakhir terpotong dan scrollbar horizontal muncul.
- Judul modal terukur 15 px dan isi utama 14 px; perbedaan hierarki kurang jelas. Font isi tetap memakai stack sistem Segoe UI, sehingga masalahnya mencakup skala dan konsistensi, bukan bukti kegagalan pemuatan font.
- Dialog memiliki padding 20 px, sedangkan navigasi menambah padding horizontal sendiri. Susunan header, tab, kartu, dan footer belum memiliki ritme yang seragam.
- Isi Panduan mencampurkan emoji dengan ikon Lucide yang digunakan aplikasi.
- Setelah modal dibuka, fokus masih berada pada tombol Panduan di halaman belakang.
- Pilihan solusi awal di situs hanya menampilkan NN dan NI; perbaikan awal masih berupa checkbox 2-OPT.
- Kondisi kosong Report menyediakan ruang besar dengan sedikit informasi; rapikan agar pesan dan tindakan berikutnya mudah dipahami.

### Temuan dari kode lokal

- HelpModal.tsx memakai `help-modal-dialog` dan `help-content-area`, sedangkan styles.css mendefinisikan `.help-modal-panel` dan `.help-modal-content`. Aturan flex serta scroll khusus Panduan tidak diterapkan pada elemen yang dimaksud.
- Aturan global heading dan aturan CSS tanpa layer dapat mengalahkan utility Tailwind. Ukuran aktual judul tidak mengikuti maksud `text-base`; audit cascade sebelum menambah override.
- Ukuran teks dan spacing tersebar dalam CSS lama, utility, dan beberapa override `!important`. Input numerik memakai Consolas, sedangkan teks UI memakai font sistem.
- HelpModal menangani Escape dan klik backdrop, tetapi belum mengelola fokus awal, focus trap, pengembalian fokus, serta penguncian interaksi halaman belakang secara lengkap.
- `RunConfig.initialMethod` masih `NN | NI`, sedangkan `improve` masih boolean. Belum ada implementasi NFI dan 3-OPT pada modul baseline.
- Preview rute awal dihitung sinkron melalui App; jangan menambahkan 3-OPT berat ke jalur render tersebut.
- RunResult, trace, penyimpanan, dan ekspor saat ini dirancang untuk TS/SA. Perluasan pembanding memerlukan dukungan hasil konstruksi dan local search.
- **Cooling Rate (α) sudah tersedia pada ControlHub dan Help.** Pertahankan dan seragamkan; jangan menganggapnya fitur yang belum ada.
- `minimumTemperature` tersedia pada domain dan konfigurasi lama, tetapi belum ditampilkan sebagai field di ControlHub aktif. Batas input beberapa parameter juga berbeda dari validator domain.
- Help menjelaskan tabu tenure sebagai larangan membalik segmen kembali, sedangkan implementasi memakai atribut sisi yang dihapus dan larangan menambahkannya kembali.

Audit visual desktop, tablet, Report berisi hasil, serta seluruh modal lain belum dibuktikan oleh screenshot audit ini. Periksa saat implementasi; jangan menyatakan seluruh tampilan sudah terverifikasi berdasarkan temuan viewport sempit saja. Versi deployment juga perlu dicocokkan kembali dengan kode lokal.

## 3. Perbaikan UI dan modal Panduan

### Tipografi, spacing, dan kontrol

- Tetapkan token font menggunakan stack sistem yang sudah ada. Gunakan angka tabular pada metrik. Batasi monospace untuk kode, rumus, dan urutan rute yang memerlukannya; input parameter mengikuti font UI.
- Gunakan skala dasar: judul dialog 18 px, judul bagian 16 px, isi dan kontrol 14 px, serta keterangan 12 px. Gunakan line-height isi 1,5–1,6 dan bobot teks yang membedakan judul, label, nilai, serta keterangan.
- Gunakan skala jarak 4, 8, 12, 16, dan 24 px. Padding panel 16 px, jarak antarkelompok 16 px, dan jarak label–input 6–8 px. Pertahankan kontrol minimal setinggi 40 px; target sentuh ponsel minimal 44 px.
- Hilangkan padding berlapis yang tidak diperlukan pada komponen yang disentuh. Jangan mengurangi seluruh padding secara seragam tanpa melihat hierarki dan area klik.
- Selaraskan toolbar kanvas, konfigurasi, parameter, tombol, metrik, riwayat, kondisi kosong, dan Report menggunakan token tersebut. Pertahankan luas kanvas yang memadai.
- Rapikan cascade secara terarah. Gunakan satu sumber aturan per komponen; hindari menambah `!important` untuk menutupi konflik. Jangan menghapus CSS yang belum dipastikan tidak digunakan.
- Pertahankan kontras teks normal minimal 4,5:1, indikator fokus jelas, serta pesan validasi yang tidak hanya dibedakan dengan warna.

### Struktur dan perilaku Panduan

- Samakan nama kelas JSX dan CSS. Gunakan dialog maksimal 720 px, margin luar 16 px, dan tinggi maksimal `calc(100dvh - 32px)` dengan fallback yang sesuai browser proyek.
- Susun header, navigasi, area konten, dan footer dalam flex column. Header/navigasi/footer tidak menyusut; area konten memakai `min-height: 0` dan menjadi satu-satunya area scroll vertikal di dalam dialog.
- Pada lebar di bawah 640 px, tampilkan tab dalam grid dua kolom dan izinkan label membungkus. Navigasi tidak boleh overflow horizontal atau menutupi tombol tutup.
- Gunakan ikon Lucide yang konsisten. Ringkas judul kartu dan hilangkan dekorasi berulang yang mengganggu pembacaan.
- Saat modal dibuka, pindahkan fokus ke tombol tutup, tahan fokus di dalam dialog, dan cegah interaksi serta scroll halaman belakang. Saat ditutup, pulihkan fokus ke pemicu sebelumnya dan posisi scroll halaman.
- Dukung Escape, tombol tutup, dan klik backdrop yang tepat; klik isi dialog tidak boleh menutupnya. Bersihkan listener dan perubahan scroll/inert saat unmount.
- Gunakan semantik dialog berlabel dan tablist/tab/tabpanel, `aria-selected`, hubungan panel, serta navigasi panah dan Home/End. Ubah tab dengan keyboard tanpa memindahkan fokus ke halaman belakang.
- Buka Panduan pada tab pertama setiap kali dibuka. Saat mengganti tab, reset scroll konten ke atas.

## 4. Penyelesaian fitur metode dan eksekusi

### Pilihan eksperimen satu per satu

Sediakan pilihan jenis eksperimen di Playground:

1. **Pembentukan solusi awal:** pilih NN, NI, atau NFI dan titik awal; jalankan untuk mencatat hasil konstruksi.
2. **Local search:** bentuk rute dasar dengan NN/NI/NFI tanpa perbaikan, lalu jalankan 2-OPT atau 3-OPT. Catat rute sebelum dan sesudahnya. Perbandingan 2-OPT dengan 3-OPT menggunakan rute dasar identik, bukan menjalankan 3-OPT setelah hasil 2-OPT secara otomatis.
3. **Metaheuristik:** pilih TS atau SA, pembentuk rute awal, serta perbaikan awal Tidak ada/2-OPT/3-OPT. Pertahankan aksi menjalankan metode metaheuristik lain menggunakan snapshot dataset, rute awal, dan batas iterasi dari run sebelumnya.

Tampilkan field yang relevan untuk jenis eksperimen terpilih. Jangan menampilkan parameter suhu atau tabu pada metode konstruktif/local search. Tiap tindakan menjalankan satu metode dan menambahkan satu hasil ke riwayat.

### NFI dan 3-OPT

- Implementasikan **Nearest Farthest Insertion (NFI)** sesuai definisi proyek: mulai dari node awal dan node terdekatnya; pilih node di luar tour dengan jarak minimum-ke-tour terbesar; sisipkan pada sisi dengan kenaikan biaya terkecil. Gunakan tie-break ID node, kemudian posisi sisi. Pertahankan node awal pada posisi pertama.
- Implementasikan **3-OPT** dengan memilih tiga sisi tidak bersebelahan dan mengevaluasi rekoneksi yang membentuk satu tour valid. Kecualikan tour asal dan duplikat yang hanya berbeda rotasi atau pembalikan arah. Gunakan pemilihan perbaikan terbaik, toleransi EPSILON proyek, dan urutan enumerasi deterministik.
- Terima hanya perbaikan biaya pada local search. Hentikan ketika tidak ada perbaikan, batas langkah tercapai, atau pengguna membatalkan. Gunakan batas default 10.000 langkah perbaikan, sejalan dengan batas existing 2-OPT; jelaskan bahwa langkah dan evaluasi kandidat merupakan ukuran berbeda.
- Tangani jumlah node yang tidak memungkinkan tiga sisi tidak bersebelahan sebagai hasil tanpa perubahan dengan alasan yang jelas. Jangan menolak dataset valid hanya karena 3-OPT tidak memiliki kandidat.
- **TS dan SA tetap menggunakan neighborhood 2-OPT.** 3-OPT berfungsi sebagai local search mandiri dan pilihan perbaikan sebelum pencarian.
- Pertahankan biaya presisi penuh; pembulatan hanya pada tampilan.

### Worker dan parameter

- Pindahkan persiapan local search yang berat ke worker. Pecah enumerasi kandidat menjadi batch yang memberi kesempatan memproses pesan progress/pause/resume/cancel; memindahkan loop panjang ke constructor worker saja belum cukup.
- Hindari penghitungan 3-OPT berulang di render App, validasi awal, dan constructor engine. Gunakan hasil persiapan yang sudah selesai dan cocok dengan snapshot konfigurasi.
- Tampilkan fase persiapan dan pencarian. Abaikan hasil worker lama ketika dataset/konfigurasi sudah berubah, dan batasi update UI secara wajar.
- Jika persiapan dibatalkan, jangan menjalankan TS/SA memakai rute yang belum selesai tanpa persetujuan pengguna. Tandai hasil sebagai dibatalkan/parsial dan pertahankan hasil terbaik valid bila tersedia.
- Tambahkan field **Suhu minimum** pada kontrol SA aktif. Pertahankan **Cooling Rate (α)**. Samakan batas, rentang, dan pesan input dengan validator domain, termasuk hubungan suhu minimum dan suhu awal.
- Pertahankan default TS/SA proyek: 2.000 iterasi, tenure 7, seed 42, suhu awal 100, α 0,95, 20 iterasi per suhu, dan suhu minimum 0,001. Jangan menambahkan λ sebelum definisi, rumus, serta rentangnya disepakati.

## 5. Model hasil, perbandingan, penyimpanan, dan ekspor

### Kontrak data dan kompatibilitas

- Perluas metode konstruktif menjadi `NN | NI | NFI`. Ganti konfigurasi perbaikan boolean dengan enum `none | 2OPT | 3OPT` dan simpan pilihan itu secara eksplisit pada hasil baru.
- Gunakan hasil dengan pembeda kategori konstruksi/local-search/metaheuristik. Pertahankan trace TS/SA yang sudah ada; jangan memalsukan langkah iterasi TS/SA untuk hasil konstruksi atau memaksakan bentuk move 2-OPT pada trace 3-OPT.
- Simpan snapshot dataset, titik awal, metode konstruktif, metode perbaikan, parameter, rute masukan/hasil yang relevan, jarak, evaluasi, waktu, status, dan alasan berhenti. Rekam seed SA dan rute awal aktual yang diterima pencarian.
- Naikkan versi format sesi/ekspor secara eksplisit. Migrasikan sesi versi 1: `improve: true` menjadi `2OPT`, `false` menjadi `none`, dan hasil lama menjadi kategori metaheuristik. Pertahankan ID, dataset, rute, konfigurasi, serta trace lama.
- Pertahankan batas riwayat 10 hasil terminal terbaru dari seluruh kategori. Jangan menghapus sesi lama bila parsing/migrasi gagal; gunakan mekanisme pemulihan/pesan yang sudah ada dan simpan penggantinya hanya melalui tindakan yang sesuai alur proyek.
- Waktu tahap yang tidak tercatat pada hasil lama ditandai tidak tersedia, bukan dianggap nol. Pertahankan arti waktu pencarian legacy.

### Report dan validitas perbandingan

- Tampilkan kategori dan nama metode dengan jelas. Untuk konstruksi, tampilkan rute, jarak hasil, dan waktu; kolom perbaikan atau iterasi yang tidak berlaku berisi “—”.
- Untuk local search, tampilkan jarak sebelum/sesudah, persentase perbaikan, langkah perbaikan, evaluasi kandidat, waktu, dan alasan berhenti.
- Untuk TS/SA, pertahankan trace, current/best, parameter, iterasi, evaluasi, dan alasan berhenti. Jika hasil lain tidak memiliki trace konvergensi yang sebanding, tampilkan ringkasan yang sesuai kategorinya.
- Bedakan **dataset sama**, **rute masukan sama**, dan **batas iterasi sama**. Kecocokan dataset harus mempertimbangkan ID/koordinat dan definisi jarak, bukan nama dataset saja. Label kondisi TS–SA tidak diterapkan seolah semua metode memiliki anggaran iterasi yang sama.
- Pertahankan keterangan bahwa satu iterasi TS mengevaluasi neighborhood, sedangkan SA mengevaluasi satu kandidat. Jangan membuat kesimpulan keunggulan umum dari satu percobaan atau mencampur hasil parsial dengan hasil selesai tanpa label.
- Pisahkan durasi konstruksi, perbaikan awal, dan pencarian; tampilkan total bila seluruh tahap tersedia. Nyatakan fase yang dicakup waktu pada tabel agar penggunaan 3-OPT sebagai persiapan tidak tersembunyi.
- Untuk jarak awal nol, pertahankan penanganan persentase proyek agar tidak menghasilkan NaN/Infinity. Pastikan metrik yang tidak relevan tetap “—”.

### Ekspor

- Perluas CSV untuk kategori, metode konstruktif/perbaikan, parameter lengkap, rute awal/hasil, status, alasan berhenti, evaluasi, dan waktu tiap tahap yang tersedia.
- Perluas JSON untuk detail hasil setiap kategori, snapshot dataset, konfigurasi, serta trace yang benar-benar tersedia.
- Pertahankan quoting CSV, penanganan karakter khusus, dan perlindungan formula spreadsheet yang sudah ada. Uji isi file hasil ekspor, bukan hanya keberadaan tombol unduh.
- Pertahankan impor Excel `.xlsx`. CSV adalah ekspor perbandingan dan JSON adalah ekspor detail hasil; jangan menjanjikan impor `.xls`, CSV, atau JSON sebagai bagian pekerjaan ini.

## 6. Help, dokumentasi, dan konsistensi akademik

- Perbaiki definisi tabu tenure: atribut sisi undirected yang dihapus dicatat tabu untuk ditambahkan kembali hingga masa tenure berakhir, mengikuti batas inklusif dalam implementasi/metodologi proyek. Jelaskan aspiration berdasarkan kandidat yang mengalahkan best-so-far.
- Jelaskan best-so-far sebagai hasil terbaik yang ditemukan selama pencarian, tanpa menyamakannya dengan bukti optimum global. Jelaskan bahwa SA menerima Δ ≤ 0 dan memakai probabilitas `exp(-Δ/T)` untuk Δ > 0.
- Tambahkan langkah NFI, 3-OPT, pengaruh α, suhu minimum, seed, kondisi berhenti, perbandingan, dan ekspor. Gunakan nama kontrol yang benar-benar tampil di UI.
- Pertahankan fixture `data/example-six.json`: A(0,0), B(4,0), C(7,3), D(5,7), E(1,6), F(-2,3), dengan label sintetis dan satuan unit koordinat.
- NN dari A pada fixture tersebut sudah memiliki biaya optimum 24.686074230319797. Tampilkan perbaikan 0% sebagai hasil sah. Gunakan fixture uji tambahan atau rute suboptimal terkontrol untuk membuktikan perbaikan local search; jangan mengubah fixture acuan agar terlihat membaik.
- Pertahankan skenario acuan laporan: TS dan SA dari snapshot rute NN mulai A tanpa perbaikan awal, memakai parameter default. Skenario dengan 2-OPT/3-OPT dicatat sebagai eksperimen tambahan.
- Cocokkan perhitungan manual TS dengan trace pada dataset, rute awal, tenure, tie-break, dan aturan aspiration yang sama. Jangan mengubah semantik TS hanya agar angka terlihat sesuai laporan.
- Setelah implementasi terverifikasi, selaraskan README, docs/METHODOLOGY.md, docs/VERIFICATION.md, AGENTS.md, dan PROJECT_SUBMISSION_PLAN.md. Tandai catatan verifikasi lama dengan konteks tanggal/versi; jangan menjadikan hasil pengujian 8 Oktober sebagai bukti fitur baru.
- Pastikan panduan akses memakai alamat aplikasi atau perintah lokal yang benar. Pertahankan referensi PPT Canva dalam rencana penyerahan: https://www.canva.com/design/DAHYFX2H2c0/_3peVQq5FgyVQxW7nbZBYw/edit.
- Jangan mengedit Google Docs atau Canva sebagai efek samping implementasi kode. Laporkan kalimat/tabel/screenshot laporan dan PPT yang perlu diselaraskan; jika ada pekerjaan lanjutan pada dokumen brainstorming, pembaruan hanya pada tab **all** sesuai batasan pengguna.

## 7. Pengujian dan kriteria penerimaan

Tambahkan pengujian bermakna sesuai perubahan, kemudian jalankan `bun run check` serta `bun run test:e2e` pada browser proyek yang tersedia. Laporkan perintah, browser, hasil, dan keterbatasannya. Jangan mengklaim pengujian yang tidak dijalankan.

### Algoritma dan worker

- NFI: beberapa titik awal, tie-break, koordinat berimpit, determinisme, semua node dikunjungi tepat sekali, dan biaya dihitung ulang secara independen.
- 3-OPT: kasus membaik dan tanpa perbaikan, tour valid, biaya tidak meningkat, ukuran node kecil, batas langkah, determinisme, dan rekoneksi yang tidak membentuk subtour. Periksa biaya kandidat dari koordinat secara independen.
- TS/SA: rute awal identik, snapshot dataset tidak berubah, best-so-far tidak memburuk, TS deterministik, dan SA reproducible dengan seed/konfigurasi sama. Durasi bukan bagian yang harus identik.
- Worker: progress selama persiapan dan pencarian, pause/resume, cancel di tengah enumerasi, respons UI pada dataset hingga batas proyek, serta pesan worker lama yang diabaikan.
- Fixture enam node: biaya acuan dan perbaikan 0% tetap benar. Pertahankan pengujian lama yang masih sesuai perilaku produk.

### Penyimpanan dan alur aplikasi

- Sesi lama dengan `improve` true/false dapat dimigrasikan tanpa kehilangan hasil dan trace; sesi baru berisi hasil campuran bertahan setelah refresh.
- Dataset/parameter invalid, kegagalan worker, dan kegagalan IndexedDB menampilkan pesan serta pemulihan yang sesuai.
- Jalankan NN/NI/NFI, 2-OPT/3-OPT, dan TS/SA satu per satu; hasil tersedia di Report. Uji pengulangan TS–SA dengan snapshot awal identik serta label kondisi yang berbeda ketika inputnya berbeda.
- Periksa isi CSV/JSON untuk tiap kategori, parameter α/suhu minimum, status parsial, waktu, rute, dan metrik yang tidak berlaku.
- Pastikan kontrol suhu minimum, validasi parameter, Help, riwayat, tampilan hasil lama, serta impor `.xlsx` tetap berfungsi.

### Visual dan aksesibilitas

- Tinjau screenshot pada 390 × 844, 768 × 1024, dan 1366 × 768 untuk Playground, Report kosong/berisi hasil, serta semua tab Panduan. Periksa juga saat zoom 200%.
- Pastikan tidak ada overflow horizontal halaman atau navigasi Panduan. Tabel lebar boleh memiliki scroll pada wadahnya sendiri.
- Pastikan modal hanya menggulirkan konten; tombol tutup, navigasi, dan footer tetap dapat diakses pada viewport pendek maupun panjang.
- Uji keyboard untuk pembukaan dialog, focus trap, tab/panel, Escape, penutupan, pengembalian fokus, dan halaman belakang yang tidak interaktif. Verifikasi nama aksesibel serta status tab terpilih.
- Pastikan token font/spacing konsisten, label tidak bertabrakan, area sentuh cukup, dan animasi menghormati reduced motion.

## 8. Urutan pelaksanaan dan laporan hasil

1. Catat kondisi awal repository dan cocokkan kembali audit dengan komponen aktif.
2. Rapikan token serta struktur Panduan; periksa tampilan dan keyboard.
3. Implementasikan domain NFI/3-OPT, kontrak hasil, worker, dan migrasi sesi.
4. Hubungkan pilihan eksperimen, parameter, riwayat, Report, serta ekspor.
5. Selaraskan Help dan dokumentasi berdasarkan perilaku yang selesai dibuat.
6. Jalankan pemeriksaan, pengujian, dan tinjauan visual; perbaiki kegagalan yang terkait ruang lingkup ini.
7. Laporkan perubahan, hasil pengujian, bukti visual, status gap, serta batasan yang masih ada. Bedakan verifikasi lokal dari kondisi produksi; deployment dilakukan hanya sesuai otorisasi pengguna yang berlaku.

Pekerjaan implementasi selesai ketika fitur dapat dipakai dari alur aktif, hasilnya benar dan dapat direproduksi, sesi lama tetap dapat dibuka, ekspor sesuai hasil, serta dokumentasi dan bukti pengujian mencerminkan versi akhir.
