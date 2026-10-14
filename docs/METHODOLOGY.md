# Metodologi HeuriLab Web MVP

## Objective dan data

Tujuan TSP adalah meminimalkan total jarak tour tertutup yang mengunjungi setiap node tepat sekali.
Untuk koordinat planar, `d(a,b) = hypot(ax − bx, ay − by)` dan
`cost(r) = Σ d(r[i], r[(i+1) mod n])`. Semua metode menggunakan matriks dan fungsi biaya yang sama.

Route internal menyimpan indeks unik tanpa penutupan duplikat. Titik awal tetap selama 2-OPT.
Tie node konstruktif berdasarkan ID; tie move/posisi berdasarkan urutan indeks.
Epsilon 1e-9 membedakan improvement dari noise numerik. UI membulatkan tiga desimal,
sementara export dan perhitungan menyimpan presisi penuh.

## Constructive dan local search

**Nearest Neighbor:** mulai dari node terpilih, pilih node belum dikunjungi dengan jarak minimum,
ulangi sampai seluruh node dikunjungi, lalu tutup tour.

**Nearest Insertion:** mulai dari node terpilih dan tetangga terdekat. Pilih node di luar tour
yang jarak minimumnya terhadap anggota tour paling kecil. Sisipkan pada edge `(a,b)` yang meminimalkan
`d(a,new) + d(new,b) − d(a,b)`. Tie insertion memakai posisi edge paling awal.

**2-OPT:** hapus dua edge tidak bersebelahan `(a,b)` dan `(c,d)`, tambahkan `(a,c)` serta `(b,d)`,
dan balik segmen di antara keduanya. Delta `d(a,c)+d(b,d)−d(a,b)−d(c,d)` dievaluasi dalam O(1).
Best improvement memilih delta negatif terbaik; berhenti tanpa perbaikan atau pada 10.000 move.
Reversal seluruh tour dan move edge bersebelahan dikecualikan. Tiga node memiliki neighborhood kosong.

## Tabu Search

TS mengevaluasi seluruh neighborhood 2-OPT current dan memilih kandidat eligible termurah,
termasuk kandidat yang lebih buruk dari current. Edge undirected yang dihapus pada iterasi k
menjadi tabu untuk ditambahkan kembali selama k+1 sampai k+tenure, inklusif.
Kandidat tabu menjadi eligible melalui aspiration jika biayanya lebih kecil dari best-so-far minus epsilon.
Best-so-far diperbarui hanya ketika current membaik.

Default tenure 7, valid 1–100. Aspiration selalu aktif pada MVP. Alasan berhenti:
batas iterasi, tidak ada kandidat eligible, neighborhood kosong, atau cancel.
Tidak ada kandidat eligible menghasilkan run selesai dengan best yang tersedia, bukan error.

## Simulated Annealing

SA memilih move 2-OPT secara uniform melalui RNG Mulberry32 ber-seed uint32.
Untuk delta ≤ 0, kandidat diterima dan random draw acceptance tidak diperlukan.
Untuk delta > 0, `p = exp(−delta/T)` dan kandidat diterima jika `draw < p`.
Current dapat memburuk; best-so-far hanya diperbarui jika membaik.

Default suhu awal 100, cooling rate 0,95, 20 iterasi per suhu, suhu minimum 0,001.
Suhu dikalikan cooling rate setelah blok iterasi per suhu selesai. Cooling rate valid `0 < rate < 1`;
suhu finite positif; minimum lebih kecil dari initial. Alasan berhenti: batas iterasi, suhu minimum,
neighborhood kosong, atau cancel. Seed default 42, rentang 0–4.294.967.295.

Cooling rate dipakai secara eksplisit; tidak diasumsikan identik dengan α formulasi tugas dosen.
λ belum didefinisikan dan tidak menjadi kontrol aktif.

## Trace, perbandingan, dan reproducibility

Trace mencatat iteration, move, delta, candidate/current/best cost, acceptance, serta alasan.
TS menambahkan tabu status, aspiration, dan tabu list/expiry; SA menambahkan suhu, probability, dan draw.
Route tiap iterasi direkonstruksi dari initial dan move accepted. JSON menyediakan snapshot dataset,
konfigurasi, initial/current/best route, trace, status, alasan berhenti, serta durasi.

TS deterministik; SA reproducible untuk dataset, route awal, konfigurasi, dan seed yang sama.
Durasi tidak termasuk jaminan reproducibility dan mengecualikan waktu paused.
Counter evaluations adalah jumlah kandidat yang diperiksa; counter iterations adalah move yang diproses.
TS dapat mengevaluasi kandidat tambahan pada pemeriksaan akhir tanpa kandidat eligible.

Perbandingan memeriksa snapshot dataset, unit Euclidean, initial route, dan budget iterasi.
Perbedaan diberi label. Kesamaan kondisi tidak menjamin kesamaan beban komputasi: TS memeriksa
seluruh neighborhood, SA satu kandidat. Run cancelled memuat hasil parsial.

## Fixture dan batas akademik

Contoh: A(0,0), B(4,0), C(7,3), D(5,7), E(1,6), F(−2,3). Start A.
NN menghasilkan A → F → E → D → C → B → A dengan biaya 24,686074230319797.
Oracle enumerasi 120 tour yang berawal di A mengonfirmasi optimum fixture ini.
Rute reverse mempunyai biaya sama karena matriks simetris.

Hasil fixture tidak membuktikan optimum algoritma untuk input lain. Tidak ada klaim satu metode
selalu lebih baik. Implementasi mendukung Euclidean planar; matriks resmi/satuan geografis
dan formulasi tugas perlu ditinjau ketika sumber akademik tersedia.
