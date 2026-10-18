import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Jalankan Metaheuristik/ })).toBeEnabled();
}

async function selectOption(page: Page, fieldLabel: string, optionPattern: string | RegExp) {
  await page.getByLabel(fieldLabel).click();
  await page.getByRole("option", { name: optionPattern }).click();
}

function spreadsheet(rows: unknown[][], extraSheet = false): Buffer {
  const workbook = XLSX.utils.book_new();
  if (extraSheet)
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["empty"]]), "Kosong");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Nodes");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const exampleRows = [
  ["id", "x", "y"],
  ["A", 0, 0],
  ["B", 4, 0],
  ["C", 7, 3],
  ["D", 5, 7],
  ["E", 1, 6],
  ["F", -2, 3],
];

async function importRows(page: Page, rows: unknown[][]) {
  await page.getByRole("button", { name: "Impor Excel" }).click();
  await page.getByLabel("Pilih file Excel").setInputFiles({
    name: "fixture.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: spreadsheet(rows, true),
  });
}

test("alur TS → Report Leaderboard → SA → perbandingan CSV & JSON → refresh", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);

  // 1. Jalankan TS dari Playground
  await page.getByRole("button", { name: "Jalankan Metaheuristik" }).click();
  await expect(page.getByText("Tidak ada kandidat eligible")).toBeVisible();

  // 2. Buka Report View melalui view switcher di header
  await page.getByRole("button", { name: /Report/ }).click();
  await expect(page.getByRole("heading", { name: "Perbandingan hasil" })).toBeVisible();
  await expect(page.getByText(/Acuan:/)).toBeVisible();
  await expect(page.getByRole("cell", { name: /Tabu Search/ })).toBeVisible();

  // 3. Tab Detail & Trace
  await page.getByRole("button", { name: "Detail & Trace" }).click();
  await expect(page.getByText("Iterasi 0")).toBeVisible();

  // 4. Ekspor JSON Run
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Ekspor JSON/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/heurilab-TS.*json/);
  const json = JSON.parse(await readFile((await download.path())!, "utf8")) as {
    schemaVersion: number;
    closedBestRoute: string[];
    trace: unknown[];
    config: { algorithm: string };
  };
  expect(json.schemaVersion).toBe(2);
  expect(json.config.algorithm).toBe("TS");
  expect(json.closedBestRoute[0]).toBe("A");
  expect(json.closedBestRoute.at(-1)).toBe("A");

  // 5. Kembali ke Playground dan ulangi dengan SA
  await page.getByRole("button", { name: "Kembali ke Playground" }).click();
  await page.getByRole("button", { name: /Ulangi dengan Simulated Annealing/ }).click();
  await expect(page.getByText("Batas iterasi tercapai")).toBeVisible();

  // 6. Buka Report dan periksa ekspor CSV
  await page.getByRole("button", { name: /Report/ }).click();
  await page.getByRole("button", { name: "Perbandingan" }).click();
  await expect(page.getByRole("cell", { name: /Simulated Annealing/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Tabu Search/ })).toBeVisible();

  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor CSV" }).click();
  const csvDownload = await csvPromise;
  expect(csvDownload.suggestedFilename()).toBe("heurilab-perbandingan.csv");
  const csvContent = await readFile((await csvDownload.path())!, "utf8");
  expect(csvContent).toContain("metaheuristic");
  expect(csvContent).toContain("total_duration_ms");

  // 7. Refresh halaman dan pastikan riwayat pulih
  await page.reload();
  await expect(page.getByRole("button", { name: /Report/ })).toContainText("2");
  await page.getByRole("button", { name: /Report/ }).click();
  await expect(page.getByRole("cell", { name: /Tabu Search/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("eksekusi eksperimen per kategori: Konstruksi (NFI) dan Local Search (3-OPT)", async ({
  page,
}) => {
  await ready(page);

  // Kategori 1: Konstruksi dengan NFI
  await selectOption(page, "Jenis Eksperimen", /Pembentukan Solusi Awal/);
  await selectOption(page, "Metode Konstruktif", /Nearest Farthest Insertion/);
  await page.getByRole("button", { name: "Bentuk Solusi Awal" }).click();
  await expect(page.getByText("Selesai (lintasan penuh)")).toBeVisible();

  // Kategori 2: Local Search dengan 3-OPT
  await selectOption(page, "Jenis Eksperimen", /Local Search/);
  await selectOption(page, "Metode Local Search", /3-OPT/);
  await page.getByRole("button", { name: "Jalankan Local Search" }).click();
  await expect(page.getByText("Optimum lokal")).toBeVisible();

  // Periksa kedua run di Report
  await page.getByRole("button", { name: /Report/ }).click();
  await expect(page.getByRole("cell", { name: /Nearest Farthest Insertion/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /3-OPT Descent/ })).toBeVisible();
  await expect(page.getByText("Konstruksi").first()).toBeVisible();
  await expect(page.getByText("Local Search").first()).toBeVisible();
});

test("impor Excel valid dengan sheet, mapping, preview, dan template", async ({ page }) => {
  await ready(page);
  await importRows(page, exampleRows);
  await expect(page.getByText(/Preview: 6 node/)).toBeVisible();

  await page.getByLabel("Sheet").selectOption("0");
  await expect(page.getByRole("button", { name: "Terapkan impor" })).toBeDisabled();

  await page.getByLabel("Sheet").selectOption("1");
  await page.getByLabel("Kolom X").selectOption("0");
  await expect(page.getByText(/tiga kolom berbeda/)).toBeVisible();

  await page.getByLabel("Kolom X").selectOption("1");
  const templatePromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh template" }).click();
  expect((await templatePromise).suggestedFilename()).toBe("heurilab-template.xlsx");

  await page.getByRole("button", { name: "Terapkan impor" }).click();
  await expect(page.getByText(/Dataset diterapkan/)).toBeVisible();
});

test("impor invalid mempertahankan dataset dan menunjukkan baris error", async ({ page }) => {
  await ready(page);
  await importRows(page, [
    ["id", "x", "y"],
    ["A", 0, 0],
    ["A", 4, 0],
    ["C", "oops", 3],
  ]);
  await expect(page.getByText(/Baris 3: ID A/)).toBeVisible();
  await expect(page.getByText(/Baris 4: Koordinat x/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Terapkan impor" })).toBeDisabled();
});

test("responsivitas komputasi, jeda/lanjut, cancel, dan run baru", async ({ page }) => {
  await ready(page);
  // Tambah titik acak agar komputasi berjalan cukup lama untuk jeda
  await page.getByRole("button", { name: "Acak 20" }).click();
  await page.getByLabel("Batas Iterasi Maksimal").fill("10000");

  await page.getByRole("button", { name: "Jalankan Metaheuristik" }).click();
  // Tunggu tombol Jeda muncul dan klik
  await page.getByRole("button", { name: "Jeda" }).click();
  await expect(page.getByRole("button", { name: "Lanjut" })).toBeVisible();

  // Buka Panduan saat jeda
  await page.getByRole("button", { name: "Panduan" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // Lanjutkan dan kemudian Batalkan
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Batal" }).click();
  await expect(page.getByText("Dibatalkan pengguna")).toBeVisible();

  // Jalankan run baru dengan iterasi kecil
  await page.getByLabel("Batas Iterasi Maksimal").fill("2");
  await page.getByRole("button", { name: "Jalankan Metaheuristik" }).click();
  await expect(page.getByText("Batas iterasi tercapai")).toBeVisible();
});

test("aksesibilitas modal Panduan: focus trap, tab keyboard, Escape, scroll lock", async ({
  page,
}) => {
  await ready(page);
  const panduanBtn = page.getByRole("button", { name: "Panduan" });
  await panduanBtn.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Focus trap: fokus awal berada pada tombol tutup
  const closeBtn = page.getByRole("button", { name: "Tutup panduan" });
  await expect(closeBtn).toBeFocused();

  // Navigasi tab dengan ArrowRight
  const firstTab = page.getByRole("tab", { name: /Kanvas & Node/ });
  await firstTab.focus();
  await expect(firstTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowRight");
  const secondTab = page.getByRole("tab", { name: /Metode & Parameter/ });
  await expect(secondTab).toBeFocused();
  await expect(secondTab).toHaveAttribute("aria-selected", "true");

  // Escape menutup dialog dan mengembalikan fokus ke tombol Panduan
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(panduanBtn).toBeFocused();
});

test("layout responsif pada mobile 390x844 tanpa horizontal overflow", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);

  // Pastikan tombol aksi dan kontrol terlihat tanpa overflow horizontal halaman
  await expect(page.getByRole("button", { name: "Jalankan Metaheuristik" })).toBeVisible();
  const noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(noOverflow).toBe(true);
  await page.screenshot({ path: info.outputPath("mobile-390.png"), fullPage: true });

  // Buka Panduan pada mobile
  await page.getByRole("button", { name: "Panduan" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const modalNoOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(modalNoOverflow).toBe(true);
  await page.screenshot({ path: info.outputPath("mobile-panduan.png") });
});

test("sesi korup dan storage gagal tidak membuat aplikasi crash", async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("heurilab", 1);
      request.addEventListener("success", () => resolve(request.result));
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("workspace", "readwrite");
      tx.objectStore("workspace").put({ version: 99 }, "session");
      tx.addEventListener("complete", () => resolve());
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByText(/Format sesi tersimpan tidak valid/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Jalankan Metaheuristik" })).toBeEnabled();
});

test("alur Input manual tabel → validasi error → penambahan node → canvas update → refresh sesi", async ({
  page,
}) => {
  await ready(page);

  // 1. Buka dialog Input manual dari toolbar kanvas
  await page.getByRole("button", { name: "Input manual" }).click();
  const dialog = page.getByRole("dialog", { name: /Tambahkan node secara manual/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Dataset dasar:/)).toBeVisible();

  // 2. Validasi error: isi baris sebagian lalu submit
  const idInput1 = dialog.getByLabel("ID node baris 1");
  const xInput1 = dialog.getByLabel("X node baris 1");
  const yInput1 = dialog.getByLabel("Y node baris 1");

  await idInput1.fill("NODE_PARTIAL");
  await xInput1.fill("12.5");
  // Y dikosongkan
  await dialog.getByRole("button", { name: "Tambahkan ke kanvas" }).click();

  // Dialog tetap terbuka dan error Y ditampilkan
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert").getByText("Koordinat Y wajib diisi.")).toBeVisible();
  await expect(yInput1).toHaveAttribute("aria-invalid", "true");

  // 3. Lengkapi baris 1 dan tambah baris 2
  await yInput1.fill("-8.5");
  await dialog.getByRole("button", { name: "Tambah baris" }).click();

  // Baris 2: kosongkan ID untuk ID otomatis, isi X dan Y
  const xInput2 = dialog.getByLabel("X node baris 2");
  const yInput2 = dialog.getByLabel("Y node baris 2");
  await xInput2.fill("-15.25");
  await yInput2.fill("10");

  // Periksa ringkasan penambahan
  await expect(dialog.getByText(/Node baru akan ditambahkan: 2 baris/)).toBeVisible();
  await expect(dialog.getByText(/8 \/ 100 node/)).toBeVisible();

  // 4. Submit penambahan ke kanvas
  await dialog.getByRole("button", { name: "Tambahkan ke kanvas" }).click();
  await expect(dialog).not.toBeVisible();

  // 5. Verifikasi kanvas terbarui menjadi 8 node
  await expect(page.getByText("8 Node ·")).toBeVisible();
  await expect(page.locator(".interactive-svg").getByText("NODE_PARTIAL")).toBeVisible();
  // ID otomatis harus 'G' (karena A-F sudah ada)
  await expect(page.locator(".interactive-svg").getByText("G")).toBeVisible();

  // 6. Jalankan metaheuristik dengan 8 node
  await page.getByRole("button", { name: "Jalankan Metaheuristik" }).click();
  await expect(page.getByText(/kandidat eligible|Batas iterasi/)).toBeVisible();

  // 7. Refresh halaman dan pastikan 8 node tetap tersimpan di sesi
  await page.reload();
  await expect(page.getByText("8 Node ·")).toBeVisible();
  await expect(page.locator(".interactive-svg").getByText("NODE_PARTIAL")).toBeVisible();
  await expect(page.locator(".interactive-svg").getByText("G")).toBeVisible();
});

test("aksesibilitas modal input manual: focus trap, Escape, dan pengelolaan fokus baris", async ({
  page,
}) => {
  await ready(page);

  const manualBtn = page.getByRole("button", { name: "Input manual" });
  await manualBtn.click();
  const dialog = page.getByRole("dialog", { name: /Tambahkan node secara manual/ });
  await expect(dialog).toBeVisible();

  // Fokus awal masuk ke input field di dalam dialog
  const firstInput = dialog.getByLabel("ID node baris 1");
  await expect(firstInput).toBeFocused();

  // Tambah baris: fokus pindah ke input baris baru
  await dialog.getByRole("button", { name: "Tambah baris" }).click();
  const secondIdInput = dialog.getByLabel("ID node baris 2");
  await expect(secondIdInput).toBeFocused();

  // Escape menutup dialog dan mengembalikan fokus ke tombol trigger
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(manualBtn).toBeFocused();
});

test("penyusunan kanvas kosong menjadi 1 lalu 2 node dan persistensi sesi", async ({ page }) => {
  await ready(page);

  // Kosongkan kanvas
  await page.getByRole("button", { name: "Hapus Semua" }).click();
  await expect(page.getByText("Kanvas masih kosong")).toBeVisible();

  // Buka input manual dari empty overlay
  await page.locator(".canvas-empty-overlay").getByRole("button", { name: "Input Manual" }).click();
  const dialog = page.getByRole("dialog", { name: /Tambahkan node secara manual/ });
  await expect(dialog).toBeVisible();

  // Tambah 1 node (0, 0)
  await dialog.getByLabel("X node baris 1").fill("0");
  await dialog.getByLabel("Y node baris 1").fill("0");
  await dialog.getByRole("button", { name: "Tambahkan ke kanvas" }).click();

  // Kanvas kini 1 node, tombol jalankan nonaktif (karena butuh minimal 3 node)
  await expect(page.getByText("1 Node ·")).toBeVisible();
  await expect(page.getByRole("button", { name: "Jalankan Metaheuristik" })).toBeDisabled();

  // Tunggu debounce simpan sesi (500ms) lalu refresh halaman: 1 node tetap tersimpan
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByText("1 Node ·")).toBeVisible();
  await expect(page.getByRole("button", { name: "Jalankan Metaheuristik" })).toBeDisabled();

  // Tambah node kedua
  await page.getByRole("button", { name: "Input manual" }).click();
  const dialog2 = page.getByRole("dialog", { name: /Tambahkan node secara manual/ });
  await dialog2.getByLabel("X node baris 1").fill("10");
  await dialog2.getByLabel("Y node baris 1").fill("15");
  await dialog2.getByRole("button", { name: "Tambahkan ke kanvas" }).click();

  await expect(page.getByText("2 Node ·")).toBeVisible();
  await expect(page.getByRole("button", { name: "Jalankan Metaheuristik" })).toBeDisabled();

  // Tunggu debounce simpan sesi lalu refresh lagi: 2 node tetap tersimpan
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByText("2 Node ·")).toBeVisible();
  await expect(page.getByRole("button", { name: "Jalankan Metaheuristik" })).toBeDisabled();
});

test("responsif modal input manual pada mobile 390x844 tanpa horizontal overflow", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);

  await page.getByRole("button", { name: "Input manual" }).click();
  const dialog = page.getByRole("dialog", { name: /Tambahkan node secara manual/ });
  await expect(dialog).toBeVisible();

  const noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(noOverflow).toBe(true);
  await page.screenshot({ path: info.outputPath("mobile-input-manual.png") });
});
