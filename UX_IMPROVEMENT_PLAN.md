# HeuriLab — Rencana Penyempurnaan UX & Desain UI (shadcn & beUI)

> **Dokumen:** Rencana Teknis & Desain Perbaikan UX  
> **Target:** 5 Permintaan Perbaikan Pengguna  
> **Pendekatan Desain:** shadcn UI components + beUI.dev motion & interactions

---

## 1. Ringkasan Eksekutif & 5 Fokus Perbaikan

Berdasarkan masukan pengguna, rencana ini merinci perbaikan konkret untuk 5 aspek utama:

1. **Penghapusan Riwayat Report/Run**: Pengguna dapat menghapus riwayat run satu per satu (_individual delete_) maupun sekaligus (_clear all history_), dengan sinkronisasi ke IndexedDB lokal.
2. **Transparansi Sumber Run pada Analisis Konvergensi**: Memberikan pemilih run (_Run Selector Pill/Dropdown_) yang sangat jelas, kartu identitas run terpilih, serta opsi kurva overlay untuk membandingkan 2 run sekaligus.
3. **Modal Panduan Interaktif**: Panduan disajikan dalam bentuk dialog pop-up modal beranimasi halus (_motion spring beUI_), berlatar _backdrop blur_, dilengkapi tab navigasi topik dan tombol tutup instan.
4. **Pembaruan Desain UI (shadcn UI + beUI.dev)**: Mengganti elemen native browser (khususnya tag `<select>` yang kaku) dengan komponen **Custom Select shadcn**, animasi floating popover, styled badge, dan micro-interactions modern.
5. **Kejelasan Sumber Data & Interaktivitas Matriks Jarak**: Menampilkan secara gamblang dari dataset mana matriks dihitung (Dataset Kanvas Aktif vs Run Tertentu), menampilkan koordinat node pada header tabel, serta fitur _crosshair highlight_ dan tooltip formula jarak Euclidean saat kursor diarahkan ke sel matriks.

---

## 2. Rincian Desain & Spesifikasi Solusi

### 2.1. Poin 1: Fitur Hapus Riwayat Report/Run

#### Masalah Saat Ini

Hasil run yang telah dijalankan tersimpan otomatis di memory dan IndexedDB (hingga 10 run), namun pengguna tidak memiliki tombol untuk menghapus run yang tidak relevan atau membersihkan seluruh riwayat saat ingin memulai eksperimen baru.

#### Solusi Rencana

- **Hapus Per Run (Individual)**:
  - Pada setiap baris di Leaderboard Report dan pada setiap kartu di tab Riwayat Panel 4, disediakan tombol hapus dengan ikon tempat sampah (`Trash2`).
  - Dilengkapi konfirmasi cepat (_popover confirm_ atau toast undo) agar tidak sengaja terhapus.
- **Hapus Semua Riwayat (_Clear All Runs_)**:
  - Tombol _"Bersihkan Semua Riwayat"_ di toolbar atas halaman Report.
- **Dukungan State Management (`src/app/workspace.tsx`)**:
  - Tambahkan action baru:
    ```typescript
    | { type: "remove_run"; id: string }
    | { type: "clear_runs" }
    ```
  - State `selectedId` otomatis beralih ke run berikutnya atau `null` jika riwayat kosong.
  - Sesi di IndexedDB langsung ter-sinkronisasi.

---

### 2.2. Poin 2: Identitas & Pemilih Run pada Analisis Konvergensi

#### Masalah Saat Ini

Saat membuka tab "Analisis Konvergensi & Trace Detail", grafik dan tabel langkah langsung muncul tanpa indikator jelas bahwa data tersebut berasal dari Run nomor berapa, metode apa, atau parameter apa yang digunakan.

#### Solusi Rencana

1. **Run Selector Bar yang Menonjol**:
   - Di bagian paling atas tab Trace/Konvergensi, diletakkan bilah pemilih run:
     ```text
     [Pilih Eksperimen]: ( #1 Tabu Search · 142.50 km ) [ #2 Sim. Annealing · 148.10 km (Aktif) ]
     ```
   - Pengguna bisa mengeklik pill run mana pun untuk langsung beralih grafik dan trace detail tanpa harus kembali ke leaderboard.
2. **Header Kartu Identitas Eksperimen**:
   - Menampilkan ringkasan lengkap run yang sedang dianalisis:
     - Badge Metode: `Tabu Search (TS)` atau `Simulated Annealing (SA)`.
     - Waktu Run: Jam dan tanggal eksekusi.
     - Dataset: Nama dataset dan jumlah node yang digunakan saat run tersebut dieksekusi.
     - Parameter Aktif: Tenure, Suhu Awal, Cooling Rate, Seed, dan Metode Solusi Awal.
3. **Multi-Run Comparison Overlay (Fitur Unggulan)**:
   - Pada grafik konvergensi, sediakan checkbox _"Bandingkan dengan Run Lain"_ sehingga grafik bisa menampilkan 2 kurva sekaligus (contoh: kurva penurunan TS warna hijau vs kurva SA warna biru dalam 1 kanvas grafik) untuk membandingkan kecepatan konvergensi secara visual.

---

### 2.3. Poin 3: Modal Dialog Panduan Interaktif (beUI Motion)

#### Masalah Saat Ini

Meskipun sudah diubah menjadi dialog, panduan perlu dipoles agar sesuai standar modal dialog modern berbasis beUI:

- Animasi muncul: _Spring scale_ (`scale: 0.95 -> 1`, `opacity: 0 -> 1`) dari beUI.
- Backdrop: _Blurred backdrop_ (`rgba(15, 23, 42, 0.45)` dengan `backdrop-filter: blur(6px)`).
- Penataan Konten: Tab kategori horizontal di dalam modal agar pengguna mudah mencari informasi tanpa harus scroll panjang:
  1. **Kanvas & Node**: Cara klik taruh node, drag posisi, dan upload Excel.
  2. **Algoritma & Parameter**: Penjelasan makna Tabu Tenure, Suhu SA, Cooling Rate, dan Solusi Awal (NN/NI + 2-OPT).
  3. **Laporan & Trace**: Cara membaca leaderboard, grafik konvergensi, dan keputusan move.
  4. **Formula & Jarak**: Perhitungan jarak Euclidean dan konsep Tour TSP tertutup.

---

### 2.4. Poin 4: Pembaruan Desain UI (shadcn UI + beUI.dev)

#### Masalah Saat Ini

Input form pilihan (seperti metode optimasi, solusi awal, titik awal startId) masih memakai elemen HTML native `<select>` yang tampilannya kaku dan berbeda-beda di setiap sistem operasi.

#### Solusi Rencana

1. **Komponen Custom Select shadcn UI (`src/components/ui/select.tsx`)**:
   - **Trigger Button**: Desain minimalis dengan label aktif, border halus, hover efek elegan, dan chevron icon berotasi saat menu terbuka.
   - **Floating Popover**: Muncul mengambang di bawah trigger dengan efek bayangan halus (_box-shadow: 0 10px 25px rgba(0,0,0,0.1)_) dan border halus.
   - **Option Items**: Dilengkapi checkmark (`Check`) pada item aktif, hover state lembut, dan dukungan keyboard navigation (Panah Atas/Bawah, Enter, Escape).
   - Terapkan di semua tempat:
     - Pemilihan Solusi Awal (`Nearest Neighbor` / `Nearest Insertion`).
     - Pemilihan Titik Awal (`Node A`, `Node B`, dst).
     - Pemilihan Algoritma (`Tabu Search` / `Simulated Annealing`).
     - Pemilihan Run di halaman Report.
2. **Karakter Desain beUI.dev**:
   - Menggunakan kurva animasi _spring_ halus pada interaksi tombol, tab switcher, dan modal.
   - Mengintegrasikan micro-animations pada saat nilai metrik berubah atau rute selesai dihitung.

---

### 2.5. Poin 5: Kejelasan Sumber Data & Interaktivitas Matriks Jarak

#### Masalah Saat Ini

Pada tab "Matriks Jarak", pengguna tidak mengetahui apakah angka-angka jarak tersebut dihitung dari **Dataset Kanvas Aktif saat ini** (yang mungkin sudah digeser-geser nodenya) atau berasal dari **Dataset pada Run tertentu di masa lalu**. Selain itu, sel matriks hanya berupa angka polos tanpa informasi koordinat node.

#### Solusi Rencana

1. **Pemberitahuan Sumber Data Eksplisit (Data Origin Badge)**:
   - Di bagian atas matriks, sediakan selektor sumber data:
     ```text
     Sumber Data Matriks:
     (●) Dataset Kanvas Saat Ini (7 Node · Termutakhir)
     (○) Dataset Run #1 (TS — 6 Node)
     ```
   - Berikan teks informasi: _"Matriks dihitung berdasarkan posisi koordinat terkini pada kanvas."_
2. **Header Tabel yang Informatif**:
   - Baris dan kolom tidak hanya menampilkan ID node (`A`, `B`, `C`), melainkan juga koordinatnya:
     - Contoh: `A (0, 0)`, `B (4, 0)`, `C (7, 3)`.
3. **Crosshair Highlight & Interactive Formula Tooltip**:
   - Saat pengguna mengarahkan kursor (_hover_) ke sel jarak antara Node `C` dan Node `D`:
     - Kolom `C` dan baris `D` otomatis mendapatkan _highlight background_ (efek crosshair).
     - Muncul tooltip detail di atas sel:
       ```text
       Jarak Euclidean antara C (7, 3) dan D (5, 7):
       d = √((7 - 5)² + (3 - 7)²) = √(4 + 16) = √20 ≈ 4.472 unit
       ```
   - Pengguna akademis dan mahasiswa dapat langsung memahami asal-usul angka jarak secara transparan.

---

## 3. Wireframe Visual Perubahan

### A. Tampilan Tab Report dengan Fitur Hapus & Pemilih Run

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [← Kembali ke Playground]  Laporan & Perbandingan Eksperimen     [CSV] [JSON] [🗑 Reset]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [📊 Leaderboard (3 Runs)]   [📈 Analisis Konvergensi]   [📐 Matriks Jarak Interaktif]   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TAB ANALISIS KONVERGENSI:                                                              │
│ Pilih Run untuk Dianalisis:                                                            │
│ ┌───────────────────────────────────┐ ┌───────────────────────────────────┐            │
│ │ [●] #2 Tabu Search (142.50 km)    │ │ [ ] #1 Sim. Annealing (148.10 km) │            │
│ └───────────────────────────────────┘ └───────────────────────────────────┘            │
│                                                                                        │
│ ┌─ KARTU IDENTITAS RUN #2 ───────────────────────────────────────────────────────────┐ │
│ │ Metode: Tabu Search (TS)  ·  Status: Selesai  ·  Durasi: 0.18s  ·  Dataset: 6 Node │ │
│ │ Awal: 187.80 km → Akhir: 142.50 km (+24.12% perbaikan) · Tenure: 7 · Neighborhood │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        │
│ [Grafik Konvergensi: Biaya vs Iterasi]  [Checkbox: Bandingkan kurva dengan Run #1]    │
│ [Tabel Trace Langkah Keputusan]                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### B. Tampilan Matriks Jarak Interaktif

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Sumber Matriks: [● Dataset Kanvas Terkini (6 Node)]  [○ Run #2 (TS)]                   │
│ Unit: unit koordinat · Aturan: Euclidean Planar Simetris                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│   Node     │  A (0,0)  │  B (4,0)  │  C (7,3)  │  D (5,7)  │  E (1,6)  │  F (-2,3)     │
├────────────┼───────────┼───────────┼───────────┼───────────┼───────────┼───────────────┤
│  A (0,0)   │   0.000   │   4.000   │   7.616   │   8.602   │   6.083   │    3.606      │
│  B (4,0)   │   4.000   │   0.000   │   4.243   │   7.071   │   6.708   │    6.708      │
│  C (7,3)   │   7.616   │   4.243   │   0.000   │ [ 4.472 ]*│   6.708   │    9.000      │
│  ...       │   ...     │   ...     │   ...     │   ...     │   ...     │    ...        │
└────────────────────────────────────────────────────────────────────────────────────────┘
  *Tooltip saat hover sel [C, D]:
   "Jarak C(7,3) ke D(5,7): √((7-5)² + (3-7)²) = 4.472 unit"
```

---

## 4. Struktur Modul & Rencana Kode

```text
src/
├── app/
│   ├── App.tsx                     # Integrasi modal panduan beUI & status
│   └── workspace.tsx               # Reducer actions: remove_run, clear_runs
├── components/
│   └── ui/
│       ├── select.tsx              # Komponen Select kustom bergaya shadcn UI
│       ├── dialog.tsx              # Komponen Dialog/Modal dengan spring motion beUI
│       └── ui.tsx                  # Base Button, Field, Tooltip styling
├── features/
│   ├── experiment/
│   │   ├── ControlHub.tsx          # Menggunakan Custom Select untuk opsi algoritma/startId
│   │   └── HelpModal.tsx           # Modal Panduan interaktif bertab
│   └── report/
│       ├── ReportView.tsx          # Halaman Report dengan fitur hapus & selector run
│       ├── ConvergenceAnalysis.tsx # Analisis konvergensi dengan pemilih run & multi-overlay
│       └── InteractiveMatrix.tsx   # Matriks interaktif dengan hover formula & data origin
```

---

## 5. Tahapan Implementasi (Roadmap)

| Tahap       | Rincian Pekerjaan                                                                                                                                                                                                     | File Terkait                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Tahap 1** | **State Management Hapus Run** <br>• Tambah action `remove_run` & `clear_runs` di reducer <br>• Tombol hapus di riwayat run & tabel leaderboard                                                                       | `src/app/workspace.tsx`, `ControlHub.tsx`, `ReportView.tsx` |
| **Tahap 2** | **Komponen Custom Select (shadcn + beUI)** <br>• Buat komponen `Select` kustom dengan keyboard navigation, floating popover, dan checkmark <br>• Ganti semua tag `<select>` di ControlHub                             | `src/components/ui/select.tsx`, `ControlHub.tsx`            |
| **Tahap 3** | **Analisis Konvergensi dengan Pemilih Run Jelas** <br>• Tambahkan bilah pemilih run aktif <br>• Tampilkan header identitas lengkap (metode, dataset, parameter) <br>• Opsi perbandingan 2 kurva konvergensi sekaligus | `ReportView.tsx`                                            |
| **Tahap 4** | **Modal Panduan Interaktif Modern** <br>• Buat dialog panduan beUI dengan tab kategori dan animasi spring <br>• Dukungan keyboard `Escape` & backdrop click                                                           | `src/features/experiment/HelpModal.tsx`, `App.tsx`          |
| **Tahap 5** | **Matriks Jarak Informatif & Interaktif** <br>• Selektor sumber data (Kanvas vs Run) <br>• Header tabel dengan koordinat `(x, y)` <br>• Hover crosshair & tooltip formula perhitungan Euclidean                       | `ReportView.tsx`, `styles.css`                              |
| **Tahap 6** | **Verifikasi Kualitas & Testing** <br>• Jalankan `bun run check` (typecheck, lint, test, build) <br>• Uji coba interaktif di browser subagent                                                                         | Semua file                                                  |

---

Silakan ditinjau rancangan di atas. Jika sudah sesuai dengan kebutuhan, beri tahu saya untuk mulai mengeksekusi Tahap 1 hingga Tahap 6!
