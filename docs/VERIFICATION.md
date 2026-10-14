# Verifikasi Web MVP

Tanggal: 8 Oktober 2026. Lingkungan: Windows, Bun 1.4.2, Node.js 22.22.0.
Browser: Google Chrome 154.0.8037.98 dan Microsoft Edge 154.0.4258.62.

## Hasil akhir

| Pemeriksaan                                  | Hasil                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------- |
| Oxfmt format check                           | Lulus                                                                 |
| Oxlint dengan deny-warnings                  | Lulus, tanpa warning/error kode                                       |
| TypeScript strict                            | Lulus                                                                 |
| Pengujian domain/adapter/reducer melalui Bun | 22 lulus, 0 gagal; 5.385 assertions                                   |
| Build produksi Vite                          | Lulus                                                                 |
| Playwright pada build produksi               | 18 lulus, 0 gagal: 9 skenario di Chrome dan Edge                      |
| Screenshot desktop/mobile                    | Ditinjau; layout 1365×900 dan 390×844                                 |
| Kontras teks/kontrol utama                   | Sampel warna foreground/background terhitung ≥ 4,5:1 di kedua browser |

Perintah yang dijalankan: `bun run check` dan `bun run test:e2e`.
Playwright membangun aplikasi produksi dan menguji server preview pada port 4173.
Warning NO_COLOR/FORCE_COLOR berasal dari environment runner; pemeriksaan kode sendiri bersih.

## Cakupan domain

- Validasi dataset, ID duplikat, ukuran 3–100, koordinat finite/berimpit, overflow, dan invariant route.
- Matriks simetris, diagonal nol, biaya route tertutup, serta konfigurasi parameter invalid.
- Brute-force independen untuk 120 tour fixture enam node; optimum 24,686074230319797 unit.
- NN/NI dengan titik awal berbeda dan tie-break deterministik; 2-OPT memperbaiki crossing.
- Seluruh delta 2-OPT pada 120 tour cocok dengan biaya yang dihitung langsung dari koordinat.
- Tabu tenure inklusif, aspiration untuk kandidat tabu, kenaikan current, best monotonic, no-eligible.
- Acceptance SA, cooling/minimum temperature, seed reproducible, dan rekonstruksi seluruh trace fixture.
- Tiga node/neighborhood kosong serta cancellation yang mempertahankan best-so-far.
- Workbook binary, format .xlsx palsu, penolakan truncation, mapping header dan nomor baris error.
- Sesi valid/korup, batas 10 run, pesan worker lama diabaikan, dan metadata/quoting CSV.

## Cakupan browser

1. TS → detail iterasi → JSON yang dibaca kembali → SA dengan kondisi awal sama → comparison → CSV → refresh riwayat.
2. Draft tidak mengubah dataset aktif, validasi duplikat, penerapan dataset, NI + 2-OPT, dan reset contoh.
3. Impor Excel valid, pemilihan sheet/kolom, preview, template download, dan penerapan impor.
4. Impor invalid tidak mengganti dataset dan menampilkan nomor baris sumber.
5. 100 node: UI tetap dapat digunakan, pause membekukan hasil, resume, cancel, serta run berikutnya.
6. Sesi korup kembali ke contoh dan dapat disimpan ulang melalui tindakan eksplisit.
7. Keyboard skip link/accordion/tab arrows, reduced motion, dan layout kecil tanpa overflow halaman.
8. IndexedDB tidak tersedia tetap memungkinkan run; kegagalan worker ditampilkan dan run baru dapat dimulai.
9. Kontras teks/kontrol utama dihitung dari style browser.

Snapshot, screenshot, dan trace gagal/diagnostik diletakkan Playwright pada `test-results/`.
Folder itu merupakan artefak pengujian, bukan source aplikasi.

## Batas bukti dan pekerjaan berikutnya

Pengujian ini memverifikasi implementasi MVP dengan contoh sintetis. Tidak mengonfirmasi dataset,
formulasi α/λ, rubrik, atau referensi resmi dosen yang belum tersedia.
Tidak mengklaim heuristik selalu optimal. Pengujian responsivitas 100 node mencakup lifecycle
pause/resume/cancel dan run baru, bukan benchmark seluruh konfigurasi 10.000 iterasi.
Kontras diperiksa pada teks/kontrol utama; audit aksesibilitas menyeluruh dengan screen reader belum dilakukan.

Review manusia atas guide/demo, teori 3-OPT, ilustrasi akademik lengkap, pitch deck, Tauri,
hosting publik, dan release repository tetap mengikuti roadmap setelah MVP.
Penyimpanan bergantung pada browser/origin dan tidak memulihkan run yang masih berjalan saat tab ditutup.
