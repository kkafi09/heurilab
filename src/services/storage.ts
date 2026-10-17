import { validateDataset, validateRoute, type Dataset } from "../domain/tsp/model";
import {
  validateConfig,
  type RunConfig,
  type RunResult,
  type StageDurations,
} from "../domain/algorithms/experiment";
import { twoOptMoves } from "../domain/algorithms/baselines";
export interface SavedSession {
  version: 2;
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
    (value.version !== 1 && value.version !== 2) ||
    !validDataset(value.dataset) ||
    !record(value.config) ||
    !Array.isArray(value.runs) ||
    value.runs.length > 10
  )
    throw new Error(
      "Format sesi tersimpan tidak valid. Contoh awal digunakan; sesi lama tidak ditimpa otomatis.",
    );

  const rawConfig = value.config as Record<string, unknown>;
  const migratedConfig: RunConfig = {
    ...rawConfig,
    category: (rawConfig.category as RunConfig["category"]) ?? "metaheuristic",
    algorithm: (rawConfig.algorithm as RunConfig["algorithm"]) ?? "TS",
    initialMethod: (rawConfig.initialMethod as RunConfig["initialMethod"]) ?? "NN",
    improve:
      typeof rawConfig.improve === "boolean"
        ? rawConfig.improve
          ? "2OPT"
          : "none"
        : ((rawConfig.improve as RunConfig["improve"]) ?? "none"),
    startId: String(rawConfig.startId ?? "A"),
    maxIterations: Number(rawConfig.maxIterations ?? 2000),
    seed: Number(rawConfig.seed ?? 42),
    tenure: Number(rawConfig.tenure ?? 7),
    initialTemperature: Number(rawConfig.initialTemperature ?? 100),
    coolingRate: Number(rawConfig.coolingRate ?? 0.95),
    iterationsPerTemperature: Number(rawConfig.iterationsPerTemperature ?? 20),
    minimumTemperature: Number(rawConfig.minimumTemperature ?? 0.001),
  };

  if (validateConfig(migratedConfig, value.dataset).length > 0) {
    throw new Error("Konfigurasi sesi tersimpan tidak valid.");
  }

  const migratedRuns: RunResult[] = [];
  for (const item of value.runs as unknown[]) {
    if (
      !record(item) ||
      !validDataset(item.dataset) ||
      !record(item.config) ||
      typeof item.id !== "string" ||
      typeof item.createdAt !== "string" ||
      !["completed", "cancelled"].includes(String(item.status)) ||
      ![
        "iteration-limit",
        "minimum-temperature",
        "no-eligible",
        "empty-neighborhood",
        "cancelled",
        "no-improvement",
        "step-limit",
        "completed",
      ].includes(String(item.stopReason))
    )
      throw new Error("Riwayat tersimpan tidak valid.");

    const rawRunConfig = item.config as Record<string, unknown>;
    const runCategory =
      (item.category as RunResult["category"]) ??
      (rawRunConfig.category as RunResult["category"]) ??
      "metaheuristic";
    const runConfig: RunConfig = {
      ...rawRunConfig,
      category: runCategory,
      algorithm: (rawRunConfig.algorithm as RunConfig["algorithm"]) ?? "TS",
      initialMethod: (rawRunConfig.initialMethod as RunConfig["initialMethod"]) ?? "NN",
      improve:
        typeof rawRunConfig.improve === "boolean"
          ? rawRunConfig.improve
            ? "2OPT"
            : "none"
          : ((rawRunConfig.improve as RunConfig["improve"]) ?? "none"),
      startId: String(rawRunConfig.startId ?? "A"),
      maxIterations: Number(rawRunConfig.maxIterations ?? 2000),
      seed: Number(rawRunConfig.seed ?? 42),
      tenure: Number(rawRunConfig.tenure ?? 7),
      initialTemperature: Number(rawRunConfig.initialTemperature ?? 100),
      coolingRate: Number(rawRunConfig.coolingRate ?? 0.95),
      iterationsPerTemperature: Number(rawRunConfig.iterationsPerTemperature ?? 20),
      minimumTemperature: Number(rawRunConfig.minimumTemperature ?? 0.001),
    };

    if (validateConfig(runConfig, item.dataset).length > 0) {
      throw new Error("Konfigurasi run pada riwayat tidak valid.");
    }

    const size = item.dataset.nodes.length;
    for (const key of ["initialRoute", "currentRoute", "bestRoute"])
      if (!Array.isArray(item[key]) || !validateRoute(item[key] as number[], size))
        throw new Error("Rute riwayat tersimpan tidak valid.");
    for (const key of [
      "initialCost",
      "currentCost",
      "bestCost",
      "durationMs",
      "iterations",
      "evaluations",
    ])
      if (typeof item[key] !== "number" || !Number.isFinite(item[key]) || (item[key] as number) < 0)
        throw new Error("Nilai riwayat tersimpan tidak valid.");

    if (!Array.isArray(item.trace) || item.trace.length > 10000)
      throw new Error("Trace tersimpan tidak valid.");

    if (runCategory === "metaheuristic") {
      // Legacy migration: jika status cancelled, trace kosong, tetapi iterations > 0 dan ada preparationMs
      // ini berasal dari pola lama di mana langkah persiapan local search disimpan ke iterations.
      if (
        item.status === "cancelled" &&
        Array.isArray(item.trace) &&
        item.trace.length === 0 &&
        typeof item.iterations === "number" &&
        item.iterations > 0 &&
        record(item.durations) &&
        typeof item.durations.preparationMs === "number"
      ) {
        (item as Record<string, unknown>).preparationSteps = item.iterations;
        (item as Record<string, unknown>).cancelledStage = "preparation";
        (item as Record<string, unknown>).iterations = 0;
        (item as Record<string, unknown>).evaluations = 0;
      }

      if (item.trace.length !== item.iterations) throw new Error("Trace tersimpan tidak valid.");
      const moves = new Set(twoOptMoves(size).map((move) => `${move.i}:${move.j}`));
      if (
        !item.trace.every(
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

    let validatedDurations: StageDurations | undefined = undefined;
    if (item.durations !== undefined && item.durations !== null) {
      if (!record(item.durations)) throw new Error("Durasi fase tidak valid.");
      const { constructionMs, preparationMs, searchMs, totalMs } = item.durations;
      if (typeof totalMs !== "number" || !Number.isFinite(totalMs) || totalMs < 0) {
        throw new Error("Durasi total tidak valid.");
      }
      for (const [key, val] of Object.entries({ constructionMs, preparationMs, searchMs })) {
        if (val !== undefined && (typeof val !== "number" || !Number.isFinite(val) || val < 0)) {
          throw new Error(`Durasi fase ${key} tidak valid.`);
        }
      }
      validatedDurations = {
        constructionMs: typeof constructionMs === "number" ? constructionMs : undefined,
        preparationMs: typeof preparationMs === "number" ? preparationMs : undefined,
        searchMs: typeof searchMs === "number" ? searchMs : undefined,
        totalMs,
      };
    }

    migratedRuns.push({
      ...(item as unknown as RunResult),
      category: runCategory,
      config: runConfig,
      durations: validatedDurations,
    });
  }

  return {
    version: 2,
    dataset: value.dataset,
    config: migratedConfig,
    runs: migratedRuns,
  };
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
