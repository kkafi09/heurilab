# Metodologi HeuriLab

## Objective dan Data

Tujuan Traveling Salesman Problem (TSP) adalah meminimalkan total jarak tour tertutup yang mengunjungi setiap titik (node) tepat satu kali dan kembali ke titik awal.
Untuk koordinat planar, jarak antar titik dihitung menggunakan metrik Euclidean:
`d(a,b) = √((ax − bx)² + (ay − by)²)`
dan total biaya tour tertutup dinyatakan oleh:
`cost(r) = Σ d(r[i], r[(i+1) mod n])`.
Semua metode menggunakan matriks jarak simetris Euclidean dan fungsi evaluasi biaya yang identik.

Route internal menyimpan indeks titik tanpa duplikasi penutupan. Titik awal tetap berada pada posisi indeks 0 sepanjang perbaikan.
Tie-break pemilihan titik konstruktif berlandaskan perbandingan ID node secara deterministik; tie-break posisi penambahan atau move berlandaskan urutan indeks terkecil.
Konstanta `EPSILON = 1e-9` digunakan untuk membedakan perbaikan nyata dari galat pembulatan floating point numerik. Antarmuka menampilkan angka hingga 3 digit desimal, sedangkan komputasi internal dan ekspor menyimpan presisi numerik penuh.

## Tiga Kategori Eksperimen Mandiri

HeuriLab mendukung pelaksanaan metode secara mandiri (satu per satu) untuk membangun perbandingan yang adil di Report:

1. **Pembentukan Solusi Awal (Konstruksi):**
   Membentuk rute awal dari himpunan titik koordinat secara deterministik tanpa move pertukaran rute:
   - **Nearest Neighbor (NN):** Mulai dari node awal terpilih, memilih titik terdekat yang belum dikunjungi pada tiap langkah hingga seluruh titik masuk ke tour.
   - **Nearest Insertion (NI):** Mulai dari subtour dua node (node awal dan tetangga terdekatnya). Memilih titik di luar tour dengan jarak minimum ke anggota tour terkecil, lalu menyisipkannya pada sisi `(a,b)` yang meminimalkan kenaikan biaya `d(a,new) + d(new,b) − d(a,b)`.
   - **Nearest Farthest Insertion (NFI):** Mulai dari subtour dua node (node awal dan tetangga terdekatnya). Memilih titik di luar tour yang memiliki jarak minimum ke subtour paling besar (paling jauh dari subtour saat ini), kemudian menyisipkannya pada sisi `(a,b)` dengan kenaikan biaya terkecil.

2. **Local Search (Pencarian Lokal):**
   Menerima rute dasar (dari NN, NI, atau NFI) tanpa perbaikan awal, lalu menerapkan algoritma descent hingga mencapai optimum lokal (tidak ada move yang memperbaiki) atau batas langkah 10.000 tercapai:
   - **2-OPT Descent:** Memilih dua sisi tidak bersebelahan, membalik urutan segmen di antara keduanya, dan menerima move dengan delta negatif terbaik (best improvement).
   - **3-OPT Descent:** Memilih tiga sisi tidak bersebelahan `(i, i+1)`, `(j, j+1)`, `(k, k+1)` yang membagi tour menjadi segmen A, B, C, D. Mengevaluasi seluruh 7 kombinasi rekoneksi yang membentuk tour tunggal valid (tanpa subtour terputus). Menerima rekoneksi dengan perbaikan delta terbaik per langkah. Jika $N < 6$, neighborhood 3-OPT kosong dan rute selesai tanpa perubahan.

3. **Metaheuristik:**
   Menjalankan algoritma stochastic atau memori pencarian untuk meloloskan diri dari optimum lokal:
   - **Tabu Search (TS):** Mengevaluasi seluruh neighborhood 2-OPT pada tiap iterasi dan memilih kandidat eligible terbaik (meskipun lebih buruk dari solusi saat ini). Sisi undirected yang dihapus pada iterasi $k$ dicatat dalam tabu list dan dilarang untuk ditambahkan kembali hingga iterasi $k + \text{tenure}$ secara inklusif. Aturan aspiration membolehkan move tabu apabila menghasilkan biaya yang lebih baik daripada solusi terbaik global (_best-so-far_). Solusi terbaik (_best-so-far_) dicatat terpisah dan monotonik tidak pernah memburuk. Default tenure: 7 (rentang 1–100).
   - **Simulated Annealing (SA):** Pada tiap iterasi, memilih satu move 2-OPT secara acak menggunakan PRNG deterministik Mulberry32 dengan seed tertentu. Jika kandidat memiliki $\Delta \le 0$, solusi baru selalu diterima. Jika $\Delta > 0$, solusi baru diterima dengan probabilitas $p = \exp(-\Delta / T)$. Suhu awal $T_0$ diturunkan secara geometris melalui cooling rate $\alpha$ ($T_{k+1} = \alpha \cdot T_k$) setelah setiap blok iterasi per suhu selesai. Pencarian berhenti jika batas iterasi tercapai, suhu mencapai suhu minimum $T_{\min}$, atau dibatalkan pengguna.

## Pembagian Durasi Komputasi (Stage Durations)

Setiap run mencatat durasi komputasi per tahap secara terpisah untuk transparansi analisis:

- **Konstruksi ($t\_{\text{const}}$):** Waktu pembuatan rute dasar dengan NN, NI, atau NFI.
- **Preparasi ($t\_{\text{prep}}$):** Waktu perbaikan awal dengan 2-OPT atau 3-OPT sebelum metaheuristik dimulai (jika opsi perbaikan diaktifkan).
- **Pencarian ($t\_{\text{search}}$):** Waktu iterasi inti pencarian metaheuristik atau descent local search.
- **Total ($t\_{\text{total}}$):** Akumulasi total waktu aktif komputasi di worker (mengecualikan jeda/pause).

## Evaluasi dan Reproducibility

- **TS:** Bersifat deterministik murni untuk konfigurasi, dataset, dan rute awal yang sama.
- **SA:** Bersifat reproducible murni bila dijalankan dengan seed, suhu awal, cooling rate $\alpha$, iterasi per suhu, dan rute awal yang sama.
- Evaluasi kandidat TS dan SA memiliki makna komputasi berbeda: satu iterasi TS mengevaluasi seluruh neighborhood 2-OPT ($O(N^2)$ kandidat), sedangkan satu iterasi SA mengevaluasi tepat satu kandidat acak ($O(1)$).

## Fixture Standar Enam Titik

Fixture uji baku HeuriLab di `data/example-six.json`:

- Node: A(0,0), B(4,0), C(7,3), D(5,7), E(1,6), F(-2,3)
- Satuan: unit koordinat planar
- Solusi NN dari A: A → F → E → D → C → B → A dengan panjang 24.686074230319797.
- Solusi tersebut telah diverifikasi independen oleh oracle permutasi 120 tour tertutup sebagai solusi optimum global. Perbaikan 0% pada fixture ini adalah sah dan membuktikan bahwa solusi awal sudah mencapai titik optimum.
