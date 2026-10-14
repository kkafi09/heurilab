# HeuriLab — Rencana Implementasi Canvas 8:4 Playground & Report

> **Dokumen:** Rencana Teknis dan Desain Antarmuka  
> **Status:** Siap Dieksekusi  
> **Fokus:** Transformasi layout ke proporsi 8:4, header-only shell, kanvas interaktif bebas pasang/geser node & upload, serta sistem laporan (report) riwayat eksperimen.

---

## 1. Ringkasan Eksekutif & Visi Desain

Rancangan ini mengubah HeuriLab dari tata letak berbasis formulir tradisional menjadi **laboratorium berbasis kanvas interaktif (Visual-First Playground)**:

1. **Header-Only Shell**: Menghapus hero/intro banner besar (`.intro`) dan footer tebal, sehingga 100% viewport vertikal langsung terisi oleh area kerja aktif.
2. **Proporsi Grid 8 : 4**:
   - **Area 8 (Kiri, ~66.7%)**: _Interactive Canvas Playground_ untuk menaruh node secara bebas, menggeser (_drag_), mengunggah dataset, dan memantau rute pencarian secara real-time.
   - **Area 4 (Kanan, ~33.3%)**: _Control & Experiment Hub_, berisi pemilihan algoritma (Tabu Search / Simulated Annealing), pengaturan parameter, kartu metrik langsung, serta riwayat eksperimen (_runs_).
3. **Dual View (Playground & Dedicated Report)**:
   - **Playground View**: Fokus ke eksplorasi visual, manipulasi node, dan eksekusi algoritma.
   - **Report View**: Tab khusus untuk membandingkan semua hasil yang pernah dijalankan dalam bentuk leaderboard, grafik konvergensi biaya (_cost over iterations_), trace langkah-demi-langkah, dan ekspor.

---

## 2. Wireframe Arsitektur Antarmuka

### A. Layout Utama (Mode Playground 8 : 4)

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [⚗️ HeuriLab]   │   [ ◧ Playground ]   [ 📊 Report (3) ]   │   [● Tersimpan Lokal]  [📖 Panduan]       │  <- HEADER RAMPING
├───────────────────────────────────────────────────────────────┬────────────────────────────────────────┤
│                       AREA 8 (PLAYGROUND)                     │          AREA 4 (PANEL KANAN)          │
│ ┌───────────────────────────────────────────────────────────┐ │ ┌────────────────────────────────────┐ │
│ │ Toolbar: [📍 Tambah] [✋ Geser] [📁 Upload] [🎲 Acak] [🗑]  │ │ │ [Algoritma: TS | SA]               │ │
│ ├───────────────────────────────────────────────────────────┤ │ │ Parameter: Tenure/Cooling/Seed     │ │
│ │                                                           │ │ │ Solusi Awal: Nearest Neighbor      │ │
│ │                                                           │ │ │ [ ▶ Jalankan ]  [ ⏸ Jeda ]  [ ⏹ ]   │ │
│ │                     CANVAS INTERAKTIF                     │ │ ├────────────────────────────────────┤ │
│ │                                                           │ │ │ METRIK HASIL TERKINI               │ │
│ │              • Klik di mana saja untuk tambah node        │ │ │ • Jarak Terbaik : 142.50 km        │ │
│ │              • Drag node untuk ubah posisi                │ │ │ • Peningkatan   : 24.12%           │ │
│ │              • Preview rute: Best (hijau), Current (biru) │ │ │ • Waktu / Iter  : 0.18s / 1.000    │ │
│ │                                                           │ │ ├────────────────────────────────────┤ │
│ │                                                           │ │ │ RIWAYAT CEPAT (RUNS)               │ │
│ │                                                           │ │ │ [Run 1] TS (2-OPT)   142.50 km     │ │
│ └───────────────────────────────────────────────────────────┘ │ │ [Run 2] SA (2-OPT)   148.10 km     │ │
│ [Status Kanvas: 6 Node · Skala Euclidean Planar]             │ └────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┴────────────────────────────────────────┘
```

### B. Layout Mode Report (Perbandingan Mendalam)

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [⚗️ HeuriLab]   │   [ ◧ Playground ]   [ 📊 Report (3) ]*  │   [Ekspor: JSON | CSV]  [📖 Panduan]      │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 📊 LEADERBOARD HASIL EKSPERIMEN                                                                    │ │
│ │ ┌──────────┬─────────────┬──────────────┬────────────┬─────────────┬──────────┬──────────┬───────────┐ │ │
│ │ │ Algoritma│ Solusi Awal │ Jarak Awal   │ Jarak Akhir│ Perbaikan % │ Iterasi  │ Durasi   │ Status    │ │ │
│ │ ├──────────┼─────────────┼──────────────┼────────────┼─────────────┼──────────┼──────────┼───────────┤ │ │
│ │ │ TS       │ NN + 2-OPT  │ 187.80 km    │ 142.50 km  │ +24.12%     │ 1.000    │ 0.18s    │ Selesai   │ │ │
│ │ │ SA       │ NN          │ 195.40 km    │ 148.10 km  │ +24.21%     │ 1.000    │ 0.22s    │ Selesai   │ │ │
│ │ └──────────┴─────────────┴──────────────┴────────────┴─────────────┴──────────┴──────────┴───────────┘ │ │
│ └────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────┬────────────────────────────────────────────────────┐ │
│ │ 📈 GRAFIK KONVERGENSI (Biaya vs Iterasi)      │ 🔍 TRACE STEP INSPECTOR                            │ │
│ │ (Membandingkan kurva penurunan TS vs SA)      │ (Detail kandidat terpilih, move, delta, tabu/temp) │ │
│ └───────────────────────────────────────────────┴────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi Fungsional Fitur

### 3.1. Kanvas Interaktif (Area 8)

| Fitur                         | Deskripsi Perilaku                                                                                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Click to Place Node**       | Saat tool _Add Node_ aktif (atau klik langsung pada canvas kosong), sistem membuat node baru pada koordinat `(x, y)` yang diklik. ID node otomatis bertambah (`A`, `B`, `C` ... `Z`, `A1`, dst).                 |
| **Drag & Drop Repositioning** | Pengguna dapat mengklik dan menarik (_drag_) lingkaran node ke mana saja. Saat di-drag, garis rute, koordinat numerik, dan jarak total langsung terhitung ulang secara dinamis.                                  |
| **Upload Dataset & Auto-Fit** | Tombol _Upload_ di toolbar kanvas menerima berkas `.xlsx`, `.csv`, atau `.json`. Setelah diimpor, koordinat dinormalisasi ke _bounding box_ kanvas secara rapi tanpa distorsi proporsi.                          |
| **Penyesuaian Pasca Upload**  | Node hasil upload tidak dikunci; pengguna bebas menggeser posisi node tertentu secara visual atau menghapus node yang tidak diinginkan.                                                                          |
| **Toolbar Kanvas**            | Terdiri dari: <br>• Tool selection (`Pointer` / `Tambah Node` / `Hapus`) <br>• _Preset Cepat_: 6 Node Contoh, Acak 10 Node, Acak 25 Node <br>• _Clear All_ (bersihkan kanvas) <br>• _Auto-center / Reset Zoom_   |
| **Visual Layer Rute**         | • **Best Route** (Hijau emerald solid, stroke tebal)<br>• **Current/Iteration Route** (Biru sky putus-putus)<br>• **Initial Baseline Route** (Abu-abu netral putus-putus halus)<br>• **Candidate Move** (Oranye) |

### 3.2. Panel Kontrol Eksperimen (Area 4)

1. **Pemilihan & Konfigurasi Algoritma**:
   - Pemilihan metode solusi awal: **Nearest Neighbor (NN)** atau **Nearest Insertion (NI)** dengan opsi baseline **2-OPT**.
   - Pemilihan metaheuristik inti: **Tabu Search (TS)** atau **Simulated Annealing (SA)**.
   - Parameter TS: Tenure list, aturan aspiration.
   - Parameter SA: Suhu awal, laju pendinginan (_cooling rate_), iterasi per suhu, seed.
2. **Tombol Kontrol Siklus Hidup**:
   - Tombol **Jalankan Eksperimen** (menjalankan web worker tanpa memblokir UI kanvas).
   - Tombol **Jeda / Lanjutkan** (_pause/resume_).
   - Tombol **Batalkan** (_cancel_).
3. **Live Metrics Card**:
   - Jarak Terbaik (_Best Distance_) & Jarak Awal (_Initial Distance_).
   - Persentase Peningkatan (_Improvement %_).
   - Iterasi saat ini & Total Evaluasi kandidat tetangga.
   - Waktu komputasi bersih (_elapsed execution time_).
4. **Kartu Riwayat Run Cepat (Quick Runs Card)**:
   - Daftar 10 run terakhir pada sesi aktif.
   - Klik kartu run untuk melihat kembali rute dan statusnya langsung pada kanvas.

### 3.3. Sistem Report (Hasil yang Pernah Dijalankan)

1. **Navigasi Tab Report**:
   - Tombol toggle di header `[ ◧ Playground | 📊 Report ]` dengan lencana jumlah run aktif (contoh: `Report (3)`).
2. **Komponen Halaman Report**:
   - **Tabel Komparasi Lengkap**: Membandingkan performa setiap run yang memakai dataset yang sama.
   - **Chart Komparasi Multigaris**: Grafik konvergensi multi-run untuk melihat perbedaan laju penurunan biaya antara TS dan SA.
   - **Trace Log & Alasan Keputusan**: Penelusuran step detail mengapa kandidat tertentu diterima atau ditolak (misal: probabilitas Boltzmann pada SA atau status tabu pada TS).
   - **Export Center**: Download hasil perbandingan dalam bentuk **Excel (.xlsx)**, **CSV**, atau **JSON**.

---

## 4. Rincian Teknis & Rencana Kode

### 4.1. Modifikasi State Workspace (`src/app/workspace.tsx`)

Menambahkan aksi manipulasi node interaktif ke dalam reducer:

```typescript
type Action =
  | { type: "restore"; session: SavedSession }
  | { type: "dataset"; dataset: Dataset }
  | { type: "add_node"; x: number; y: number }
  | { type: "move_node"; id: string; x: number; y: number }
  | { type: "remove_node"; id: string }
  | { type: "clear_nodes" }
  | { type: "config"; config: RunConfig }
  | { type: "start"; id: string }
  | { type: "worker"; message: WorkerResponse }
  | { type: "select"; id: string }
  | { type: "error"; message: string };
```

### 4.2. Struktur Komponen Baru

```text
src/
├── app/
│   ├── App.tsx                    # Mengatur tab aktif (playground / report) & shell 8:4
│   ├── Header.tsx                 # Header ramping (Brand, Switcher Playground/Report, Session status)
│   └── workspace.tsx              # Reducer dengan aksi add/move/remove node
├── features/
│   ├── canvas/
│   │   ├── InteractiveCanvas.tsx  # SVG/Canvas interaktif dengan click-to-add & drag-node
│   │   ├── CanvasToolbar.tsx      # Tool penambahan node, acak, upload, dan clear
│   │   ├── NodeDragHandle.tsx     # Handler interaksi pointer/mouse drag
│   │   └── RouteRenderer.tsx      # Rendering garis rute berlapis (best, current, initial)
│   ├── experiment/
│   │   ├── ControlPanel.tsx       # Panel kanan (kolom 4): form konfigurasi & tombol run
│   │   ├── LiveMetricsCard.tsx    # Kartu ringkasan metrik hasil terkini
│   │   └── QuickRunsList.tsx      # Daftar run yang pernah dijalankan di kolom 4
│   └── report/
│       ├── ReportView.tsx         # Tampilan penuh tab Report
│       ├── ComparisonTable.tsx    # Tabel leaderboard komparasi run
│       ├── ConvergenceChart.tsx   # Grafik penurunan cost TS vs SA
│       └── TraceInspector.tsx     # Detail penelusuran keputusan algoritma
```

---

## 5. Rencana Tahapan Eksekusi (Implementation Phases)

### Fase 1: Restrukturisasi Shell & Header Ramping

- Buat komponen `Header.tsx` baru yang minimalis tanpa banner intro besar.
- Tambahkan state navigasi mode: `view: "playground" | "report"`.
- Atur container layout `grid grid-cols-12 gap-4` (8 kolom kiri, 4 kolom kanan).

### Fase 2: Implementasi Interactive Canvas (Area 8)

- Implementasikan SVG interaktif dengan koordinat pointer-to-SVG.
- Fitur **Click to Add Node** dengan ID generator otomatis.
- Fitur **Drag to Move Node** dengan pointer event listeners (`onPointerDown`, `onPointerMove`, `onPointerUp`).
- Update otomatis rute awal (_initial tour_) dan jarak saat posisi node berubah.

### Fase 3: Integrasi Upload & Penyesuaian Dataset

- Tambahkan tombol Upload langsung di toolbar kanvas.
- Integrasikan parser Excel (`xlsx`) dan CSV dengan dialog pratinjau ringkas.
- Implementasikan auto-fit koordinat agar node hasil upload pas di kanvas dan tetap bisa digeser secara manual.

### Fase 4: Integrasi Panel Kontrol & Riwayat Cepat (Area 4)

- Porting konfigurasi algoritma (TS dan SA) ke kolom 4 yang proporsional.
- Integrasikan kartu metrik hasil eksperimen langsung.
- Buat daftar _Quick Runs_ untuk beralih hasil run yang telah disimpan.

### Fase 5: Halaman Dedicated Report & Verifikasi

- Buat view `ReportView.tsx` dengan tabel perbandingan seluruh run, grafik biaya per iterasi, dan ekspor.
- Verifikasi komprehensif:
  - Uji tambah node bebas, drag node, dan upload file.
  - Uji eksekusi TS & SA dan pembaruan hasil di Playground serta Report.
  - Jalankan `bun test` dan typecheck `tsc -b`.
