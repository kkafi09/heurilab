import { validateDataset, validateRoute, type Dataset } from "../domain/tsp/model";
import { validateConfig, type RunConfig, type RunResult } from "../domain/algorithms/experiment";
import { twoOptMoves } from "../domain/algorithms/baselines";
export interface SavedSession {
  version: 1;
  dataset: Dataset;
  config: RunConfig;
  runs: RunResult[];
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function validDataset(value: unknown): value is Dataset {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.unit !== "string" ||
    typeof value.provenance !== "string" ||
    !Array.isArray(value.nodes)
  )
    return false;
  if (
    !value.nodes.every(
      (node: unknown) =>
        record(node) &&
        typeof node.id === "string" &&
        typeof node.x === "number" &&
        typeof node.y === "number",
    )
  )
    return false;
  return validateDataset(value as unknown as Dataset).length === 0;
}
export function parseSession(value: unknown): SavedSession {
  if (
    !record(value) ||
    value.version !== 1 ||
    !validDataset(value.dataset) ||
    !record(value.config) ||
    validateConfig(value.config as unknown as RunConfig, value.dataset).length ||
    !Array.isArray(value.runs) ||
    value.runs.length > 10
  )
    throw new Error(
      "Format sesi tersimpan tidak valid. Contoh awal digunakan; sesi lama tidak ditimpa otomatis.",
    );
  for (const run of value.runs as unknown[]) {
    if (
      !record(run) ||
      !validDataset(run.dataset) ||
      !record(run.config) ||
      validateConfig(run.config as unknown as RunConfig, run.dataset).length ||
      typeof run.id !== "string" ||
      typeof run.createdAt !== "string" ||
      !["completed", "cancelled"].includes(String(run.status)) ||
      ![
        "iteration-limit",
        "minimum-temperature",
        "no-eligible",
        "empty-neighborhood",
        "cancelled",
      ].includes(String(run.stopReason))
    )
      throw new Error("Riwayat tersimpan tidak valid.");
    const size = run.dataset.nodes.length;
    for (const key of ["initialRoute", "currentRoute", "bestRoute"])
      if (!Array.isArray(run[key]) || !validateRoute(run[key] as number[], size))
        throw new Error("Rute riwayat tersimpan tidak valid.");
    for (const key of [
      "initialCost",
      "currentCost",
      "bestCost",
      "durationMs",
      "iterations",
      "evaluations",
    ])
      if (typeof run[key] !== "number" || !Number.isFinite(run[key]) || run[key] < 0)
        throw new Error("Nilai riwayat tersimpan tidak valid.");
    if (
      !Array.isArray(run.trace) ||
      run.trace.length !== run.iterations ||
      run.trace.length > 10000
    )
      throw new Error("Trace tersimpan tidak valid.");
    const moves = new Set(twoOptMoves(size).map((move) => `${move.i}:${move.j}`));
    if (
      !run.trace.every(
        (step: unknown, index: number) =>
          record(step) &&
          step.iteration === index + 1 &&
          record(step.move) &&
          moves.has(`${step.move.i}:${step.move.j}`) &&
          typeof step.accepted === "boolean" &&
          typeof step.reason === "string" &&
          [step.candidateCost, step.currentCost, step.bestCost, step.delta].every(
            (cost) => typeof cost === "number" && Number.isFinite(cost),
          ),
      )
    )
      throw new Error("Isi trace tersimpan tidak valid.");
  }
  return value as unknown as SavedSession;
}
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("heurilab", 1);
    request.addEventListener("upgradeneeded", () => request.result.createObjectStore("workspace"));
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () =>
      reject(new Error("Penyimpanan browser tidak dapat dibuka.")),
    );
    request.addEventListener("blocked", () =>
      reject(new Error("Penyimpanan sedang digunakan oleh tab lain.")),
    );
  });
}
export async function loadSession(): Promise<SavedSession | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("workspace", "readonly"),
        request = transaction.objectStore("workspace").get("session");
      request.addEventListener("success", () => {
        try {
          resolve(request.result === undefined ? null : parseSession(request.result));
        } catch (error) {
          reject(error);
        }
      });
      request.addEventListener("error", () => reject(new Error("Sesi gagal dibaca.")));
    });
  } finally {
    db.close();
  }
}
export async function saveSession(session: SavedSession): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("workspace", "readwrite");
      transaction.objectStore("workspace").put(session, "session");
      transaction.addEventListener("complete", () => resolve());
      transaction.addEventListener("error", () =>
        reject(
          new Error(
            "Sesi gagal disimpan. Eksperimen tetap tersedia dalam memori; ekspor sebelum menutup tab.",
          ),
        ),
      );
      transaction.addEventListener("abort", () =>
        reject(new Error("Penyimpanan sesi dibatalkan.")),
      );
    });
  } finally {
    db.close();
  }
}
