# Dataset contoh

`example-six.json` adalah fixture kanonik yang diimpor oleh model domain; template Excel di UI
dibuat dari fixture yang sama. Sumbernya sintetis untuk pembelajaran, dengan koordinat planar
dan satuan unit koordinat. Bukan dataset tugas resmi.

Start default A. NN menghasilkan A → F → E → D → C → B → A, biaya 24,686074230319797.
Reverse tour mempunyai biaya sama. Brute-force oracle pada pengujian domain mengonfirmasi optimum
dengan menghitung langsung dari koordinat. Aturan jarak, precision, dan metode dijelaskan pada
`docs/METHODOLOGY.md`.
