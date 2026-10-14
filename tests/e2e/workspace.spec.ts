import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Jalankan eksperimen", exact: true }),
  ).toBeEnabled();
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
  await page.getByRole("button", { name: "Impor Excel", exact: true }).click();
  await page.getByLabel("Pilih file Excel").setInputFiles({
    name: "fixture.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: spreadsheet(rows, true),
  });
}

test("alur TS → trace → SA → perbandingan → ekspor → refresh", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await page.getByRole("button", { name: "Jalankan eksperimen", exact: true }).click();
  await expect(page.getByText("Tidak ada kandidat eligible", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lihat iterasi 1", exact: true }).click();
  await expect(page.getByText("Kandidat tabu:", { exact: false })).toBeVisible();
  await expect(page.getByRole("img", { name: /Visualisasi rute/ })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor JSON", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/heurilab-TS.*json/);
  const json = JSON.parse(await readFile((await download.path())!, "utf8")) as {
    schemaVersion: number;
    closedBestRoute: string[];
    trace: unknown[];
    config: { algorithm: string };
  };
  expect(json.schemaVersion).toBe(1);
  expect(json.config.algorithm).toBe("TS");
  expect(json.trace).toHaveLength(3);
  expect(json.closedBestRoute[0]).toBe("A");
  expect(json.closedBestRoute.at(-1)).toBe("A");
  await expect(page.getByTestId("best-cost")).toHaveText("24,686");
  await page.getByRole("button", { name: "Jalankan metode lain" }).click();
  await expect(page.getByText("Batas iterasi tercapai", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Perbandingan/ }).click();
  await expect(page.getByRole("button", { name: "Lihat run TS" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lihat run SA" })).toBeVisible();
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor CSV" }).click();
  expect((await csvPromise).suggestedFilename()).toBe("heurilab-perbandingan.csv");
  await expect(page.getByText("Tersimpan lokal")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("best-cost")).toHaveText("24,686");
  await page.getByRole("tab", { name: /Perbandingan/ }).click();
  await expect(page.getByRole("button", { name: "Lihat run TS" })).toBeVisible();
  expect(errors).toEqual([]);
});
test("input draft tidak mengubah data aktif; invalid ditolak, NI + 2-OPT bekerja", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("ID node 2", { exact: true }).fill("A");
  await page.getByRole("button", { name: "Terapkan", exact: true }).click();
  await expect(page.getByText(/digunakan lebih dari sekali/)).toBeVisible();
  await expect(page.getByTestId("best-route")).toHaveText("A → F → E → D → C → B → A");
  await page.getByLabel("ID node 2", { exact: true }).fill("B");
  await page.getByLabel("X node 1", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Terapkan", exact: true }).click();
  await expect(page.getByText("Dataset manual", { exact: true })).toBeVisible();
  await page.getByLabel("Solusi awal", { exact: true }).selectOption("NI");
  await page.getByLabel("Perbaiki solusi awal dengan 2-OPT").check();
  await page.getByLabel("Batas iterasi", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Jalankan eksperimen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Jalankan metode lain" })).toBeVisible();
  await expect(page.getByText(/NI \+ 2-OPT · start/)).toBeVisible();
  await page.getByLabel("ID node 1", { exact: true }).fill("BROKEN");
  await page.getByRole("button", { name: "Contoh 6 node", exact: true }).click();
  await expect(page.getByLabel("ID node 1", { exact: true })).toHaveValue("A");
  await expect(page.getByLabel("X node 1", { exact: true })).toHaveValue("0");
});
test("impor Excel valid dengan sheet, mapping, preview, dan template", async ({ page }) => {
  await ready(page);
  await importRows(page, exampleRows);
  await expect(page.getByText(/Preview: 6 node/)).toBeVisible();
  await expect(page.getByText("Enam titik · contoh sintetis", { exact: true })).toBeVisible();
  await page.getByLabel("Sheet", { exact: true }).selectOption("0");
  await expect(page.getByRole("button", { name: "Terapkan impor" })).toBeDisabled();
  await page.getByLabel("Sheet", { exact: true }).selectOption("1");
  await page.getByLabel("Kolom X", { exact: true }).selectOption("0");
  await expect(page.getByText(/tiga kolom berbeda/)).toBeVisible();
  await page.getByLabel("Kolom X", { exact: true }).selectOption("1");
  const templatePromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh template" }).click();
  expect((await templatePromise).suggestedFilename()).toBe("heurilab-template.xlsx");
  await page.getByRole("button", { name: "Terapkan impor" }).click();
  await expect(page.getByText("Impor · Nodes", { exact: true })).toBeVisible();
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
  await expect(page.getByTestId("best-route")).toHaveText("A → F → E → D → C → B → A");
});
test("100 node: UI responsif, jeda/lanjut, cancel, dan run baru", async ({ page }) => {
  await ready(page);
  const rows: unknown[][] = [
    ["id", "x", "y"],
    ...Array.from({ length: 100 }, (_, i) => [`N${i}`, Math.cos(i) * 100 + i, Math.sin(i) * 100]),
  ];
  await importRows(page, rows);
  await page.getByRole("button", { name: "Terapkan impor" }).click();
  await page.getByLabel("Batas iterasi", { exact: true }).fill("10000");
  await page.getByRole("button", { name: "Jalankan eksperimen", exact: true }).click();
  await page.getByRole("button", { name: "Jeda", exact: true }).click();
  await expect(page.getByRole("button", { name: "Lanjutkan", exact: true })).toBeVisible();
  const before = await page.getByTestId("best-cost").innerText();
  await page.waitForTimeout(200);
  expect(await page.getByTestId("best-cost").innerText()).toBe(before);
  await page.getByRole("button", { name: "Panduan" }).click();
  await expect(page.getByText("Mulai dari rasa ingin tahu")).toBeVisible();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Jeda", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Batalkan", exact: true }).click();
  await expect(page.getByText("Dibatalkan pengguna", { exact: true })).toBeVisible();
  await expect(page.getByTestId("best-cost")).not.toHaveText("—");
  await page.getByLabel("Batas iterasi", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Jalankan eksperimen", exact: true }).click();
  await expect(page.getByText("Batas iterasi tercapai", { exact: true })).toBeVisible();
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
  await expect(
    page.getByRole("button", { name: "Jalankan eksperimen", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Simpan sesi saat ini" }).click();
  await expect(page.getByText("Tersimpan lokal")).toBeVisible();
});
test("keyboard, reduced motion, layout kecil, dan screenshot", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Lewati ke workspace" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Panduan" }).click();
  await page.getByRole("button", { name: "Mengapa current bisa lebih buruk dari best?" }).click();
  await expect(
    page.getByText(/TS memilih kandidat eligible terbaik meskipun lebih buruk/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Panduan" }).click();
  await page.getByRole("tab", { name: "Trace iterasi", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Perbandingan/ })).toBeFocused();
  await expect(page.getByRole("tab", { name: /Perbandingan/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("ArrowLeft");
  await page.screenshot({ path: info.outputPath("desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Jalankan eksperimen", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("mobile.png"), fullPage: true });
});
test("storage tidak tersedia dan worker gagal tetap memberi aksi pemulihan", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("IndexedDB tidak tersedia");
      },
    });
  });
  await ready(page);
  await expect(page.getByText("IndexedDB tidak tersedia", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Jalankan eksperimen", exact: true }).click();
  await expect(page.getByText("Tidak ada kandidat eligible", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = window.Worker;
    const unavailableMessage = "Worker sengaja tidak tersedia";
    window.Worker = function UnavailableWorker() {
      throw new Error(unavailableMessage);
    } as unknown as typeof Worker;
    setTimeout(() => {
      window.Worker = original;
    }, 500);
  });
  await page.getByRole("button", { name: "Jalankan eksperimen", exact: true }).click();
  await expect(page.getByText("Worker sengaja tidak tersedia", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Jalankan eksperimen", exact: true }),
  ).toBeEnabled();
  await expect.poll(() => page.evaluate(() => window.Worker.name)).toBe("Worker");
  await page.getByRole("button", { name: "Jalankan eksperimen", exact: true }).click();
  await expect(page.getByText("Tidak ada kandidat eligible", { exact: true })).toBeVisible();
});
test("kontras teks utama dan kontrol mencapai 4,5:1", async ({ page }) => {
  await ready(page);
  const failures = await page.evaluate(() => {
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- Helpers must live inside this serialized browser callback.
    const rgb = (color: string) =>
      color
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number) ?? [255, 255, 255];
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- Helpers must live inside this serialized browser callback.
    const luminance = (components: number[]) =>
      components
        .map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
    const failed: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(
      ".muted,.field>span,.metric>span,.metric>small,.legend>span,.eyebrow,.intro p,.count-tag,.status-pill,.example-badge,.run-button,footer,.lab-note",
    )) {
      if (!element.getClientRects().length) continue;
      let ancestor: Element | null = element,
        background = "rgb(255,255,255)";
      while (ancestor) {
        const color = getComputedStyle(ancestor).backgroundColor;
        if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
          background = color;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      const foreground = luminance(rgb(getComputedStyle(element).color)),
        back = luminance(rgb(background)),
        ratio = (Math.max(foreground, back) + 0.05) / (Math.min(foreground, back) + 0.05);
      if (ratio < 4.5)
        failed.push(
          `${element.tagName}.${element.className} ${element.textContent?.trim().slice(0, 30)}: ${ratio.toFixed(2)}:1`,
        );
    }
    return failed;
  });
  expect(failures).toEqual([]);
});
