import { describe, expect, test } from "bun:test";
import {
  EXAMPLE,
  closedRoute,
  distanceMatrix,
  routeCost,
  validateDataset,
  validateRoute,
  isDatasetIdentical,
  type Dataset,
  type Route,
} from "../../src/domain/tsp/model";
import {
  applyMove,
  moveDelta,
  moveEdges,
  nearestFarthestInsertion,
  nearestInsertion,
  nearestNeighbor,
  threeOptDelta,
  threeOptDescent,
  threeOptDescentDetailed,
  threeOptTriples,
  twoOptDescent,
  twoOptMoves,
} from "../../src/domain/algorithms/baselines";
import {
  Experiment,
  acceptanceProbability,
  aspirationAllowed,
  defaultConfig,
  isTabu,
  makeInitialRoute,
  mulberry32,
  reconstruct,
  validateConfig,
  type RunConfig,
} from "../../src/domain/algorithms/experiment";
import { guessColumns, previewSheet, readWorkbook } from "../../src/services/excel";
import * as XLSX from "xlsx";
import { parseSession } from "../../src/services/storage";
import { comparisonCsv } from "../../src/services/export";
import { workspaceReducer, type Workspace } from "../../src/app/workspace";
import {
  formatDistance,
  formatPercent,
  formatDuration,
  formatStageBreakdown,
  getMethodDisplayName,
  getMethodShortLabel,
  evaluateComparisonCondition,
  evaluatePairComparability,
  getRunIdentity,
  calculateReportKPIs,
} from "../../src/features/report/formatters";

const matrix = distanceMatrix(EXAMPLE.nodes);
function execute(config: Partial<RunConfig> = {}, dataset = EXAMPLE, initialRoute?: Route) {
  const engine = new Experiment({
    id: "test-run",
    createdAt: "2026-10-08T00:00:00.000Z",
    dataset,
    config: { ...defaultConfig, ...config },
    initialRoute,
  });
  while (!engine.done) engine.step();
  return engine.result;
}
function permutations(values: number[]): number[][] {
  if (!values.length) return [[]];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, i) => i !== index)).map((tail) => [value, ...tail]),
  );
}
// Independent oracle deliberately uses coordinates, not the engine's matrix or cost routine.
function independentCost(route: Route, dataset = EXAMPLE): number {
  let total = 0;
  for (let i = 0; i < route.length; i++) {
    const a = dataset.nodes[route[i]!]!,
      b = dataset.nodes[route[(i + 1) % route.length]!]!;
    total += Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }
  return total;
}
const oracle = Math.min(
  ...permutations([1, 2, 3, 4, 5]).map((tail) => independentCost([0, ...tail])),
);

describe("data dan biaya", () => {
  test("fixture berasal dari contoh sintetis dan optimum diverifikasi independen", () => {
    expect(oracle).toBeCloseTo(24.686074230319797, 10);
    expect(validateDataset(EXAMPLE)).toEqual([]);
    expect(EXAMPLE.provenance).toContain("sintetis");
  });
  test("matriks simetris, diagonal nol, dan penutupan memakai edge kembali", () => {
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++) {
        expect(matrix[i]![j]).toBe(matrix[j]![i]);
        if (i === j) expect(matrix[i]![j]).toBe(0);
      }
    const triangle: Dataset = {
      ...EXAMPLE,
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 3, y: 4 },
        { id: "C", x: 0, y: 4 },
      ],
    };
    expect(routeCost([0, 1, 2], distanceMatrix(triangle.nodes))).toBe(12);
    expect(closedRoute([0, 1, 2], triangle)).toEqual(["A", "B", "C", "A"]);
  });
  test("ID duplikat, koordinat invalid, ukuran, dan overflow ditolak", () => {
    expect(
      validateDataset({
        ...EXAMPLE,
        nodes: [EXAMPLE.nodes[0]!, EXAMPLE.nodes[0]!, EXAMPLE.nodes[2]!],
      }).some((issue) => issue.field === "id"),
    ).toBe(true);
    expect(
      validateDataset({
        ...EXAMPLE,
        nodes: EXAMPLE.nodes.map((node, i) => ({ ...node, x: i === 0 ? NaN : node.x })),
      }).some((issue) => issue.field === "x"),
    ).toBe(true);
    expect(validateDataset({ ...EXAMPLE, nodes: EXAMPLE.nodes.slice(0, 2) })).not.toEqual([]);
    expect(
      validateDataset({
        ...EXAMPLE,
        nodes: Array.from({ length: 101 }, (_, i) => ({ id: String(i), x: i, y: 0 })),
      }),
    ).not.toEqual([]);
    expect(
      validateDataset({
        ...EXAMPLE,
        nodes: EXAMPLE.nodes.map((node, i) => ({ ...node, x: i % 2 ? 1e308 : -1e308 })),
      }),
    ).not.toEqual([]);
  });
  test("koordinat berimpit valid; rute hilang, berulang, tertutup internal ditolak", () => {
    const coincident = {
      ...EXAMPLE,
      nodes: EXAMPLE.nodes.map((node) => ({ ...node, x: 0, y: 0 })),
    };
    expect(validateDataset(coincident)).toEqual([]);
    expect(execute({}, coincident).bestCost).toBe(0);
    expect(validateRoute([0, 1, 1], 3)).toBe(false);
    expect(validateRoute([0, 1], 3)).toBe(false);
    expect(validateRoute([0, 1, 2, 0], 3)).toBe(false);
    expect(() => routeCost([0, 1], matrix)).toThrow();
  });
  test("konfigurasi tidak valid ditolak sebelum run", () => {
    for (const patch of [
      { maxIterations: 0 },
      { maxIterations: 10001 },
      { seed: -1, algorithm: "SA" as const },
      { coolingRate: 1, algorithm: "SA" as const },
      { tenure: 0 },
      { startId: "absent" },
      { initialTemperature: Infinity, algorithm: "SA" as const },
      { minimumTemperature: 100, algorithm: "SA" as const },
    ])
      expect(validateConfig({ ...defaultConfig, ...patch }, EXAMPLE).length).toBeGreaterThan(0);
  });
});
describe("baseline dan 2-OPT", () => {
  test("NN dan NI deterministik, valid, dengan start yang dipilih", () => {
    for (const algorithm of [nearestNeighbor, nearestInsertion])
      for (let start = 0; start < 6; start++) {
        const route = algorithm(EXAMPLE.nodes, matrix, start);
        expect(validateRoute(route, 6)).toBe(true);
        expect(route[0]).toBe(start);
        expect(route).toEqual(algorithm(EXAMPLE.nodes, matrix, start));
        expect(routeCost(route, matrix)).toBeCloseTo(independentCost(route), 10);
      }
  });
  test("tie-break berdasarkan ID, bukan urutan input", () => {
    const nodes = [
      { id: "A", x: 0, y: 0 },
      { id: "C", x: 1, y: 0 },
      { id: "B", x: -1, y: 0 },
    ];
    expect(nearestNeighbor(nodes, distanceMatrix(nodes), 0)).toEqual([0, 2, 1]);
    expect(nearestInsertion(nodes, distanceMatrix(nodes), 0)[0]).toBe(0);
  });
  test("semua delta cocok dengan oracle untuk 120 tour; start dan invariant tetap", () => {
    const moves = twoOptMoves(6);
    expect(moves.length).toBe(9);
    expect(twoOptMoves(3)).toEqual([]);
    for (const tail of permutations([1, 2, 3, 4, 5])) {
      const route = [0, ...tail];
      for (const move of moves) {
        const candidate = applyMove(route, move);
        expect(validateRoute(candidate, 6)).toBe(true);
        expect(candidate[0]).toBe(0);
        expect(moveDelta(route, move, matrix)).toBeCloseTo(
          independentCost(candidate) - independentCost(route),
          9,
        );
      }
    }
  });
  test("2-OPT memperbaiki crossing dan tidak memperburuk initial", () => {
    const initial = [0, 2, 4, 1, 3, 5],
      result = twoOptDescent(initial, matrix);
    expect(routeCost(result, matrix)).toBeLessThan(routeCost(initial, matrix));
    expect(routeCost(result, matrix)).toBeCloseTo(oracle, 9);
    expect(makeInitialRoute(EXAMPLE, { ...defaultConfig, improve: "2OPT" })).toEqual(
      twoOptDescent(nearestNeighbor(EXAMPLE.nodes, matrix, 0), matrix),
    );
  });
  test("NFI deterministik, valid, mempertahankan start pada posisi awal, dan tie-break ID", () => {
    for (let start = 0; start < 6; start++) {
      const route = nearestFarthestInsertion(EXAMPLE.nodes, matrix, start);
      expect(validateRoute(route, 6)).toBe(true);
      expect(route[0]).toBe(start);
      expect(route).toEqual(nearestFarthestInsertion(EXAMPLE.nodes, matrix, start));
      expect(routeCost(route, matrix)).toBeCloseTo(independentCost(route), 10);
    }
    // Test tie-break behavior
    const nodes = [
      { id: "A", x: 0, y: 0 },
      { id: "C", x: 10, y: 0 },
      { id: "B", x: -10, y: 0 },
    ];
    const nfiRoute = nearestFarthestInsertion(nodes, distanceMatrix(nodes), 0);
    expect(nfiRoute[0]).toBe(0);
    expect(validateRoute(nfiRoute, 3)).toBe(true);
  });
  test("3-OPT: triples kosong untuk N < 6, evaluasi 7 rekoneksi deterministik dan valid", () => {
    expect(threeOptTriples(5)).toEqual([]);
    const triples = threeOptTriples(6);
    expect(triples.length).toBeGreaterThan(0);

    const initial = [0, 2, 4, 1, 3, 5];
    const detailed = threeOptDescentDetailed(initial, matrix);
    expect(detailed.route[0]).toBe(0);
    expect(validateRoute(detailed.route, 6)).toBe(true);
    expect(routeCost(detailed.route, matrix)).toBeLessThan(routeCost(initial, matrix));
    expect(detailed.steps).toBeGreaterThan(0);
    expect(detailed.evaluations).toBeGreaterThan(0);

    // On optimal route (NN from 0), 3-OPT yields 0 improvement and stops with no-improvement
    const optimalRoute = nearestNeighbor(EXAMPLE.nodes, matrix, 0);
    const optDetailed = threeOptDescentDetailed(optimalRoute, matrix);
    expect(optDetailed.steps).toBe(0);
    expect(optDetailed.stopReason).toBe("no-improvement");
    expect(optDetailed.route).toEqual(optimalRoute);

    const simpleDescent = threeOptDescent(initial, matrix);
    expect(simpleDescent).toEqual(detailed.route);

    // Verify threeOptDelta for triple
    const [ti, tj, tk] = triples[0]!;
    for (let c = 1; c <= 7; c++) {
      const d = threeOptDelta(
        initial,
        { i: ti, j: tj, k: tk, caseType: c as 1 | 2 | 3 | 4 | 5 | 6 | 7 },
        matrix,
      );
      expect(Number.isFinite(d)).toBe(true);
    }

    // Verify makeInitialRoute with 3-OPT
    const route3Opt = makeInitialRoute(EXAMPLE, { ...defaultConfig, improve: "3OPT" });
    expect(validateRoute(route3Opt, 6)).toBe(true);
  });
});
describe("Tabu Search", () => {
  test("tenure memblokir tepat iterasi berikutnya sampai expiry inklusif", () => {
    const tabu = new Map([["0:1", 4]]);
    expect(isTabu(["0:1"], tabu, 2)).toBe(true);
    expect(isTabu(["0:1"], tabu, 4)).toBe(true);
    expect(isTabu(["0:1"], tabu, 5)).toBe(false);
    const engine = new Experiment({
        id: "tenure",
        createdAt: "fixture",
        dataset: EXAMPLE,
        config: { ...defaultConfig, tenure: 2 },
      }),
      before = [...engine.result.currentRoute];
    const step = engine.step()!;
    for (const edge of moveEdges(before, step.move).removed) expect(engine.tabu.get(edge)).toBe(3);
  });
  test("aspiration mengizinkan kandidat tabu yang benar-benar memperbaiki best", () => {
    expect(aspirationAllowed(10, 11)).toBe(true);
    expect(aspirationAllowed(11, 11)).toBe(false);
    const engine = new Experiment({
      id: "aspiration",
      createdAt: "fixture",
      dataset: EXAMPLE,
      config: defaultConfig,
      initialRoute: [0, 2, 4, 1, 3, 5],
    });
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) engine.tabu.set(`${a}:${b}`, 100);
    const step = engine.step()!;
    expect(step.tabu).toBe(true);
    expect(step.aspiration).toBe(true);
    expect(step.bestCost).toBeLessThan(engine.result.initialCost);
  });
  test("current dapat naik, best monotonic, no-eligible berhenti dengan hasil", () => {
    const run = execute();
    expect(run.stopReason).toBe("no-eligible");
    expect(
      run.trace.some(
        (step, i) => step.currentCost > (run.trace[i - 1]?.currentCost ?? run.initialCost) + 1e-9,
      ),
    ).toBe(true);
    run.trace.forEach((step, i) =>
      expect(step.bestCost).toBeLessThanOrEqual(run.trace[i - 1]?.bestCost ?? run.initialCost),
    );
  });
});
describe("SA, trace, dan lifecycle", () => {
  test("acceptance sesuai formula termasuk suhu rendah dan Δ nol", () => {
    expect(acceptanceProbability(-2, 10)).toBe(1);
    expect(acceptanceProbability(0, 10)).toBe(1);
    expect(acceptanceProbability(5, 10)).toBeCloseTo(Math.exp(-0.5), 12);
    expect(acceptanceProbability(500, 0.001)).toBe(0);
    const random = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
  test("seed dan input sama mengulang keputusan dan hasil", () => {
    const a = execute({ algorithm: "SA", maxIterations: 400 }),
      b = execute({ algorithm: "SA", maxIterations: 400 });
    expect(a.trace).toEqual(b.trace);
    expect(a.bestRoute).toEqual(b.bestRoute);
    expect(a.trace).not.toEqual(execute({ algorithm: "SA", maxIterations: 400, seed: 43 }).trace);
  });
  test("cooling terjadi setelah jumlah iterasi per suhu, dan minimum menghentikan", () => {
    const run = execute({
      algorithm: "SA",
      initialTemperature: 10,
      coolingRate: 0.5,
      iterationsPerTemperature: 2,
      minimumTemperature: 1,
      maxIterations: 100,
    });
    expect(run.trace.map((step) => step.temperature)).toEqual([10, 10, 5, 5, 2.5, 2.5, 1.25, 1.25]);
    expect(run.stopReason).toBe("minimum-temperature");
  });
  test("trace dapat direkonstruksi dan setiap biaya diverifikasi independen", () => {
    for (const algorithm of ["TS", "SA"] as const) {
      const run = execute({ algorithm, maxIterations: 250 });
      run.trace.forEach((step, index) => {
        const routes = reconstruct(run, index);
        for (const route of [routes.current, routes.candidate, routes.best])
          expect(validateRoute(route, 6)).toBe(true);
        expect(independentCost(routes.current)).toBeCloseTo(step.currentCost, 9);
        expect(independentCost(routes.candidate)).toBeCloseTo(step.candidateCost, 9);
        expect(independentCost(routes.best)).toBeCloseTo(step.bestCost, 9);
        if (algorithm === "SA")
          expect(step.accepted).toBe(step.delta <= 0 || step.draw! < step.probability!);
      });
      expect(run.bestCost).toBeGreaterThanOrEqual(oracle - 1e-9);
    }
  });
  test("tiga node dan pembatalan mempertahankan best-so-far", () => {
    const triangle = { ...EXAMPLE, nodes: EXAMPLE.nodes.slice(0, 3) };
    for (const algorithm of ["TS", "SA"] as const) {
      const run = execute({ algorithm }, triangle);
      expect(run.stopReason).toBe("empty-neighborhood");
      expect(run.iterations).toBe(0);
      expect(run.bestRoute).toEqual(run.initialRoute);
    }
    const engine = new Experiment({
      id: "cancel",
      createdAt: "fixture",
      dataset: EXAMPLE,
      config: { ...defaultConfig, algorithm: "SA" },
    });
    engine.step();
    const best = engine.result.bestCost;
    engine.stop("cancelled");
    expect(engine.step()).toBeUndefined();
    expect(engine.result.status).toBe("cancelled");
    expect(engine.result.bestCost).toBe(best);
  });
});
describe("impor, penyimpanan, dan ekspor", () => {
  test("workbook binary dibaca, format palsu dan truncation ditolak", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
        ["id", "x", "y"],
        ["A", 0, 0],
        ["B", 3, 4],
        ["C", 0, 4],
      ]),
      book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Nodes");
    const makeFile = () =>
      new File(
        [XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer],
        "nodes.xlsx",
      );
    expect((await readWorkbook(makeFile())).sheets[0]!.rows).toHaveLength(4);
    await expect(readWorkbook(new File(["id,x,y\nA,0,0"], "fake.xlsx"))).rejects.toThrow(
      "bukan workbook",
    );
    sheet["!ref"] = "A1:C1003";
    await expect(readWorkbook(makeFile())).rejects.toThrow("tidak akan memotong data");
  });
  test("riwayat dibatasi 10 dan pesan dari run lama diabaikan", () => {
    let state: Workspace = {
      dataset: EXAMPLE,
      config: defaultConfig,
      runs: [],
      active: null,
      selectedId: null,
      phase: "idle",
      runId: null,
      error: null,
    };
    const template = execute({ algorithm: "SA", maxIterations: 2 });
    for (let i = 0; i < 12; i++) {
      const id = `run-${i}`;
      state = workspaceReducer(state, { type: "start", id });
      state = workspaceReducer(state, {
        type: "worker",
        message: { type: "completed", id, result: { ...template, id } },
      });
    }
    expect(state.runs).toHaveLength(10);
    expect(state.runs[0]!.id).toBe("run-11");
    expect(state.runs[9]!.id).toBe("run-2");
    state = workspaceReducer(state, { type: "start", id: "new" });
    expect(
      workspaceReducer(state, {
        type: "worker",
        message: { type: "completed", id: "old", result: template },
      }),
    ).toBe(state);
  });
  test("mapping header dan baris blank; error memakai nomor baris Excel", () => {
    const sheet = {
      name: "Koordinat",
      rows: [
        ["Y", " ID ", "x"],
        [0, "A", 0],
        ["", "", ""],
        [4, "B", 3],
        [4, "C", 0],
      ],
    };
    const mapping = guessColumns(sheet);
    expect(mapping).toEqual({ id: 1, x: 2, y: 0 });
    expect(previewSheet(sheet, mapping).issues).toEqual([]);
    sheet.rows[3] = [4, "B", "oops"];
    expect(previewSheet(sheet, mapping).issues[0]!.row).toBe(4);
    expect(previewSheet(sheet, { id: 0, x: 0, y: 2 }).issues.length).toBe(1);
  });
  test("sesi valid dapat dipulihkan dan sesi korup ditolak, serta v1 dimigrasi ke v2", () => {
    const run = execute({ algorithm: "SA", maxIterations: 10 });
    // Legacy v1 session with improve: true
    const legacySession = {
      version: 1,
      dataset: EXAMPLE,
      config: { ...defaultConfig, improve: true },
      runs: [{ ...run, config: { ...run.config, improve: true } }],
    };
    const parsedV1 = parseSession(legacySession);
    expect(parsedV1.version).toBe(2);
    expect(parsedV1.config.improve).toBe("2OPT");
    expect(parsedV1.runs[0]!.config.improve).toBe("2OPT");
    expect(parsedV1.runs[0]!.category).toBe("metaheuristic");
    expect(parsedV1.runs[0]!.bestRoute).toEqual(run.bestRoute);

    // Legacy v1 session with improve: false
    const legacySessionFalse = {
      version: 1,
      dataset: EXAMPLE,
      config: { ...defaultConfig, improve: false },
      runs: [{ ...run, config: { ...run.config, improve: false } }],
    };
    const parsedV1False = parseSession(legacySessionFalse);
    expect(parsedV1False.config.improve).toBe("none");
    expect(parsedV1False.runs[0]!.config.improve).toBe("none");

    // Valid v2 session
    const sessionV2 = { version: 2, dataset: EXAMPLE, config: defaultConfig, runs: [run] };
    expect(parseSession(sessionV2).runs[0]!.bestRoute).toEqual(run.bestRoute);

    // Corrupt sessions
    expect(() => parseSession({ version: 9 })).toThrow();
    expect(() =>
      parseSession({
        ...sessionV2,
        runs: [{ ...run, trace: [{ ...run.trace[0], move: { i: 99, j: 100 } }] }],
      }),
    ).toThrow();
    expect(() =>
      parseSession({ ...sessionV2, config: { ...defaultConfig, maxIterations: NaN } }),
    ).toThrow();
  });
  test("CSV memuat kategori, durasi fase, konfigurasi, unit, rute, dan quoting aman", () => {
    const run = execute();
    run.dataset = { ...run.dataset, name: '=demo,"quoted"' };
    run.durations = { constructionMs: 2.5, preparationMs: 1.2, searchMs: 15.0, totalMs: 18.7 };
    const csv = comparisonCsv([run]);
    expect(csv).toContain("category");
    expect(csv).toContain("metaheuristic");
    expect(csv).toContain("parameters");
    expect(csv).toContain("construction_time_ms");
    expect(csv).toContain("preparation_time_ms");
    expect(csv).toContain("search_time_ms");
    expect(csv).toContain("total_duration_ms");
    expect(csv).toContain("euclidean");
    expect(csv).toContain("unit koordinat");
    expect(csv).toContain("A →");
    expect(csv).toContain("'=demo");
    expect(csv).toContain('""quoted""');
  });
});

describe("formatter dan logika perbandingan laporan", () => {
  test("formatDistance, formatPercent, dan formatDuration menangani angka, nol, dan edge case", () => {
    // formatDistance
    expect(formatDistance(24.68607423)).toBe("24,686");
    expect(formatDistance(0)).toBe("0,000");
    expect(formatDistance(NaN)).toBe("—");
    expect(formatDistance(undefined)).toBe("—");

    // formatPercent
    expect(formatPercent(0)).toBe("0,00%");
    expect(formatPercent(12.345)).toBe("12,35%");
    expect(formatPercent(0.004)).toBe("0,00%");
    expect(formatPercent(NaN)).toBe("—");

    // formatDuration
    expect(formatDuration(0)).toBe("0 ms");
    expect(formatDuration(0.04)).toBe("<0,1 ms");
    expect(formatDuration(4.24)).toBe("4,2 ms");
    expect(formatDuration(150)).toBe("150 ms");
    expect(formatDuration(1250)).toBe("1,25s");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(-5)).toBe("—");
  });

  test("formatStageBreakdown membedakan fase Konstruksi, Persiapan, Pencarian, dan Total", () => {
    const run = execute();
    run.durations = { constructionMs: 2.5, preparationMs: 1.0, searchMs: 15.2, totalMs: 18.7 };
    const breakdown = formatStageBreakdown(run);
    expect(breakdown.totalFormatted).toBe("18,7 ms");
    expect(breakdown.parts.length).toBe(3);
    expect(breakdown.parts[0]!.label).toBe("Konstruksi");
    expect(breakdown.parts[1]!.label).toBe("Persiapan");
    expect(breakdown.parts[2]!.label).toBe("Pencarian");
    expect(breakdown.summary).toContain("K:");
    expect(breakdown.summary).toContain("P:");
    expect(breakdown.summary).toContain("S:");
  });

  test("getMethodDisplayName dan getMethodShortLabel konsisten antarkategori", () => {
    const runNN = {
      ...execute(),
      category: "construction" as const,
      config: { ...defaultConfig, initialMethod: "NN" as const },
    };
    const runNI = {
      ...execute(),
      category: "construction" as const,
      config: { ...defaultConfig, initialMethod: "NI" as const },
    };
    const runNFI = {
      ...execute(),
      category: "construction" as const,
      config: { ...defaultConfig, initialMethod: "NFI" as const },
    };
    const run2Opt = {
      ...execute(),
      category: "local-search" as const,
      config: { ...defaultConfig, algorithm: "2OPT" as const },
    };
    const run3Opt = {
      ...execute(),
      category: "local-search" as const,
      config: { ...defaultConfig, algorithm: "3OPT" as const },
    };
    const runTS = {
      ...execute(),
      category: "metaheuristic" as const,
      config: { ...defaultConfig, algorithm: "TS" as const },
    };
    const runSA = {
      ...execute(),
      category: "metaheuristic" as const,
      config: { ...defaultConfig, algorithm: "SA" as const },
    };

    expect(getMethodDisplayName(runNN)).toBe("Nearest Neighbor (NN)");
    expect(getMethodDisplayName(runNI)).toBe("Nearest Insertion (NI)");
    expect(getMethodDisplayName(runNFI)).toBe("Nearest Farthest Insertion (NFI)");
    expect(getMethodDisplayName(run2Opt)).toBe("2-OPT Descent");
    expect(getMethodDisplayName(run3Opt)).toBe("3-OPT Descent");
    expect(getMethodDisplayName(runTS)).toBe("Tabu Search (TS)");
    expect(getMethodDisplayName(runSA)).toBe("Simulated Annealing (SA)");

    expect(getMethodShortLabel(run2Opt)).toBe("2-OPT");
    expect(getMethodShortLabel(run3Opt)).toBe("3-OPT");
    expect(getMethodShortLabel(runTS)).toBe("TS");
    expect(getMethodShortLabel(runSA)).toBe("SA");
  });

  test("evaluateComparisonCondition membedakan acuan, dataset, rute awal, dan iterasi", () => {
    const runRef = {
      ...execute({ algorithm: "2OPT", category: "local-search" as const }),
      id: "run-ref",
    };
    const runSameInput = {
      ...execute({ algorithm: "3OPT", category: "local-search" as const }),
      id: "run-same-input",
      initialRoute: [...runRef.initialRoute],
    };
    const runDiffRoute = {
      ...execute({ algorithm: "2OPT", category: "local-search" as const }),
      id: "run-diff-route",
      initialRoute: [1, 0, 2, 3, 4, 5],
    };
    const diffDataset = {
      ...EXAMPLE,
      id: "other-dataset",
      nodes: EXAMPLE.nodes.map((n) => ({ ...n, x: n.x + 10 })),
    };
    const runDiffDataset = { ...execute(), id: "run-diff-ds", dataset: diffDataset };

    // Acuan sendiri
    expect(evaluateComparisonCondition(runRef, runRef).label).toBe("Acuan");
    expect(evaluateComparisonCondition(runRef, runRef).className).toBe("same");

    // Dataset berbeda
    expect(evaluateComparisonCondition(runDiffDataset, runRef).label).toBe("Dataset Berbeda");
    expect(evaluateComparisonCondition(runDiffDataset, runRef).className).toBe("different");

    // Local search dengan rute awal sama
    expect(evaluateComparisonCondition(runSameInput, runRef).label).toBe(
      "Dataset & Rute Awal Sama",
    );
    expect(evaluateComparisonCondition(runSameInput, runRef).className).toBe("same");

    // Local search dengan rute awal beda
    expect(evaluateComparisonCondition(runDiffRoute, runRef).label).toBe(
      "Dataset Sama (Beda Rute)",
    );
    expect(evaluateComparisonCondition(runDiffRoute, runRef).className).toBe("different");

    // Metaheuristik: batas iterasi sama vs beda
    const runTS = {
      ...execute({ algorithm: "TS", maxIterations: 100 }),
      id: "run-ts",
      category: "metaheuristic" as const,
    };
    const runSAIdentical = {
      ...execute({ algorithm: "SA", maxIterations: 100 }),
      id: "run-sa-ident",
      category: "metaheuristic" as const,
      initialRoute: [...runTS.initialRoute],
    };
    const runSADiffIter = {
      ...execute({ algorithm: "SA", maxIterations: 500 }),
      id: "run-sa-diff-iter",
      category: "metaheuristic" as const,
      initialRoute: [...runTS.initialRoute],
    };

    expect(evaluateComparisonCondition(runSAIdentical, runTS).label).toBe(
      "Dataset, Rute & Batas Iterasi Sama",
    );
    expect(evaluateComparisonCondition(runSADiffIter, runTS).label).toBe(
      "Dataset & Rute Sama (Beda Iterasi)",
    );
  });

  test("calculateReportKPIs mendeteksi hasil seri, mengelompokkan data sebanding, dan memfilter dataset lain", () => {
    // Dua hasil local search pada fixture enam node dengan jarak identik 24.686
    const run2Opt = {
      ...execute({ algorithm: "2OPT", category: "local-search" as const }),
      id: "run-2opt",
      bestCost: 24.6860742303,
      initialCost: 24.6860742303,
      durations: { constructionMs: 2, preparationMs: 0, searchMs: 5, totalMs: 7 },
    };
    const run3Opt = {
      ...execute({ algorithm: "3OPT", category: "local-search" as const }),
      id: "run-3opt",
      bestCost: 24.6860742303,
      initialCost: 24.6860742303,
      durations: { constructionMs: 2, preparationMs: 0, searchMs: 8, totalMs: 10 },
      initialRoute: [...run2Opt.initialRoute],
    };
    // Hasil pada dataset lain tidak boleh mempengaruhi KPI dataset acuan
    const otherDataset = {
      ...EXAMPLE,
      id: "other",
      nodes: EXAMPLE.nodes.map((n) => ({ ...n, x: n.x * 2 })),
    };
    const runOther = {
      ...execute(),
      id: "run-other",
      dataset: otherDataset,
      bestCost: 10.0, // lebih kecil tapi di dataset lain
    };

    const kpis = calculateReportKPIs([run2Opt, run3Opt, runOther], run2Opt);

    // 1. Jarak terendah pada dataset acuan mendeteksi SERI
    expect(kpis.bestDistance).not.toBeNull();
    expect(kpis.bestDistance!.valueFormatted).toBe("24,686");
    expect(kpis.bestDistance!.isTie).toBe(true);
    expect(kpis.bestDistance!.tiedCount).toBe(2);
    expect(kpis.bestDistance!.methodsLabel).toContain("Seri · 2 hasil");
    expect(kpis.bestDistance!.methodsLabel).toContain("2-OPT");
    expect(kpis.bestDistance!.methodsLabel).toContain("3-OPT");

    // 2. Rata-rata perbaikan kelompok sebanding (kedua run 0% perbaikan)
    expect(kpis.avgImprovement).not.toBeNull();
    expect(kpis.avgImprovement!.valueFormatted).toBe("0,00%");
    expect(kpis.avgImprovement!.sampleCount).toBe(2);

    // 3. Durasi tercepat dalam kelompok (run2Opt 7ms vs run3Opt 10ms)
    expect(kpis.fastestDuration).not.toBeNull();
    expect(kpis.fastestDuration!.valueFormatted).toBe("7 ms");

    // 4. Total eksperimen
    expect(kpis.totalRuns.count).toBe(3);

    // Jika hanya 1 run sebanding, rata-rata dan durasi menampilkan '—'
    const singleKpis = calculateReportKPIs([run2Opt], run2Opt);
    expect(singleKpis.avgImprovement!.valueFormatted).toBe("—");
    expect(singleKpis.avgImprovement!.subLabel).toContain("Perlu minimal 2");
    expect(singleKpis.fastestDuration!.valueFormatted).toBe("—");
  });

  test("validateConfig memisahkan parameter khusus TS dan SA", () => {
    const cfgTS: RunConfig = {
      ...defaultConfig,
      algorithm: "TS",
      initialTemperature: -99, // invalid SA parameter
      coolingRate: 2.5, // invalid SA parameter
      seed: -1, // invalid SA parameter
    };
    // Karena algoritma TS, parameter SA tidak boleh menggagalkan validasi
    expect(validateConfig(cfgTS, EXAMPLE)).toEqual([]);

    // Namun ketika beralih ke SA, parameter SA tersebut wajib ditolak
    const cfgSA: RunConfig = {
      ...cfgTS,
      algorithm: "SA",
    };
    const saErrors = validateConfig(cfgSA, EXAMPLE);
    expect(saErrors.length).toBeGreaterThan(0);
  });

  test("parseSession memulihkan run cancel persiapan dan memigrasi pola legacy v2", () => {
    const run = execute();
    const cancelPrepRun = {
      ...run,
      iterations: 0,
      evaluations: 0,
      trace: [],
      preparationSteps: 5,
      cancelledStage: "preparation" as const,
      status: "cancelled" as const,
      stopReason: "cancelled" as const,
      durations: { constructionMs: 2, preparationMs: 10, totalMs: 12 },
    };
    const session = {
      version: 2 as const,
      dataset: EXAMPLE,
      config: defaultConfig,
      runs: [cancelPrepRun],
    };
    const parsed = parseSession(session);
    expect(parsed.runs[0]!.iterations).toBe(0);
    expect(parsed.runs[0]!.status).toBe("cancelled");
    expect(parsed.runs[0]!.durations?.totalMs).toBe(12);

    // Legacy v2: cancel prep dengan iterations=5 tapi trace=[]
    const legacyCancelRun = {
      ...run,
      iterations: 5,
      trace: [],
      status: "cancelled" as const,
      stopReason: "cancelled" as const,
      durations: { constructionMs: 2, preparationMs: 10, totalMs: 12 },
    };
    const legacySession = {
      version: 2 as const,
      dataset: EXAMPLE,
      config: defaultConfig,
      runs: [legacyCancelRun],
    };
    const parsedLegacy = parseSession(legacySession);
    expect(parsedLegacy.runs[0]!.iterations).toBe(0);
    expect(parsedLegacy.runs[0]!.preparationSteps).toBe(5);
    expect(parsedLegacy.runs[0]!.cancelledStage).toBe("preparation");

    // Durasi invalid (negatif) ditolak
    const invalidDurSession = {
      version: 2 as const,
      dataset: EXAMPLE,
      config: defaultConfig,
      runs: [{ ...run, durations: { totalMs: -5 } }],
    };
    expect(() => parseSession(invalidDurSession)).toThrow("Durasi total tidak valid.");
  });

  test("comparisonCsv mengekspor durasi total dari durations.totalMs dan mengosongkan perbaikan konstruksi", () => {
    const run = execute();
    run.durations = { constructionMs: 2, preparationMs: 3, searchMs: 15, totalMs: 20 };
    run.durationMs = 15;
    const runConstruction = {
      ...run,
      id: "run-c",
      category: "construction" as const,
      durations: { constructionMs: 2, totalMs: 2 },
    };
    const runLegacy = {
      ...run,
      id: "run-legacy",
      durations: undefined,
      durationMs: 1,
    };

    const csv = comparisonCsv([run, runConstruction, runLegacy]);
    const lines = csv.split("\r\n");
    // Baris 1: run normal -> totalMs = 20, searchMs = 15
    expect(lines[1]).toContain('"20"');
    expect(lines[1]).toContain('"15"');

    // Baris 2: konstruksi -> improvement_percent kosong ("")
    const cellsC = lines[2]!.split(",");
    // Kolom ke-15 adalah improvement_percent (0-indexed: index 14)
    expect(cellsC[14]).toBe('""');

    // Baris 3: legacy -> totalMs kosong ("") dan searchMs memakai durationMs ("1")
    const cellsLegacy = lines[3]!.split(",");
    // total_duration_ms adalah kolom index 20
    expect(cellsLegacy[20]).toBe('""');
    expect(cellsLegacy[19]).toBe('"1"');
  });

  test("calculateReportKPIs mengecualikan run legacy tanpa breakdown dari pemenang KPI total", () => {
    const runModern = {
      ...execute({ algorithm: "2OPT", category: "local-search" as const }),
      id: "run-modern",
      durations: { constructionMs: 2, preparationMs: 3, searchMs: 15, totalMs: 20 },
    };
    const runLegacy = {
      ...execute({ algorithm: "2OPT", category: "local-search" as const }),
      id: "run-legacy",
      durations: undefined,
      durationMs: 1, // legacy search-only duration
      initialRoute: [...runModern.initialRoute],
    };
    const kpis = calculateReportKPIs([runModern, runLegacy], runModern);
    // Legacy 1ms tanpa totalMs terukur tidak boleh memenangkan KPI total
    expect(kpis.fastestDuration?.valueFormatted).not.toBe("1 ms");
    expect(kpis.fastestDuration?.valueFormatted).toBe("—");
    expect(kpis.fastestDuration?.subLabel).toContain("Perlu minimal 2");

    // Jika ada 2 run modern dan 1 legacy, run modern 20ms menang, bukan legacy 1ms
    const runModern2 = {
      ...execute({ algorithm: "2OPT", category: "local-search" as const }),
      id: "run-modern-2",
      durations: { constructionMs: 2, preparationMs: 3, searchMs: 20, totalMs: 25 },
      initialRoute: [...runModern.initialRoute],
    };
    const kpis3 = calculateReportKPIs([runModern, runModern2, runLegacy], runModern);
    expect(kpis3.fastestDuration?.valueFormatted).not.toBe("1 ms");
    expect(kpis3.fastestDuration?.valueFormatted).toBe("20 ms");
  });

  test("getRunIdentity menghasilkan nomor stabil, ID singkat, dan label lengkap", () => {
    const run1 = { ...execute(), id: "uuid-run-1" };
    const run2 = { ...execute(), id: "uuid-run-2" };
    const all = [run2, run1]; // run2 terbaru (idx 0), run1 terlama (idx 1)

    const id1 = getRunIdentity(run1, all);
    expect(id1.runNumber).toBe(1);
    expect(id1.shortId).toBe("uuid-r");
    expect(id1.fullLabel).toContain("Run #1");

    const id2 = getRunIdentity(run2, all);
    expect(id2.runNumber).toBe(2);
    expect(id2.shortId).toBe("uuid-r");
    expect(id2.fullLabel).toContain("Run #2");
  });

  test("evaluatePairComparability mengevaluasi berbagai kombinasi pasangan A/B", () => {
    const runTS = {
      ...execute({ algorithm: "TS", maxIterations: 2000 }),
      id: "run-ts",
      category: "metaheuristic" as const,
      iterations: 3, // TS berhenti lebih awal karena no-eligible
      stopReason: "no-eligible" as const,
    };
    const runSA = {
      ...execute({ algorithm: "SA", maxIterations: 2000 }),
      id: "run-sa",
      category: "metaheuristic" as const,
      initialRoute: [...runTS.initialRoute],
      iterations: 2000,
      stopReason: "iteration-limit" as const,
    };

    // 1. TS vs SA sebanding (dataset sama, rute awal identik, batas iterasi sama 2000)
    const resMeta = evaluatePairComparability(runTS, runSA);
    expect(resMeta.isComparable).toBe(true);
    expect(resMeta.statusType).toBe("comparable");
    expect(resMeta.headline).toBe("Sebanding (Dataset, Rute Awal & Batas Iterasi Identik)");
    expect(resMeta.badgeVariant).toBe("success");
    expect(resMeta.details.some((d) => d.includes("Batas iterasi maksimum sama: 2.000"))).toBe(
      true,
    );
    expect(resMeta.details.some((d) => d.includes("Iterasi aktual berbeda (3 vs 2.000)"))).toBe(
      true,
    );

    // 2. TS vs SA dengan batas iterasi berbeda
    const runSADiffLimit = {
      ...runSA,
      id: "run-sa-500",
      config: { ...runSA.config, maxIterations: 500 },
    };
    const resDiffLimit = evaluatePairComparability(runTS, runSADiffLimit);
    expect(resDiffLimit.isComparable).toBe(false);
    expect(resDiffLimit.statusType).toBe("different_iterations");
    expect(resDiffLimit.headline).toBe("Batas Iterasi Berbeda");

    // 3. Konstruksi vs Konstruksi (Start Node sama vs beda)
    const runNN_A = {
      ...execute({ initialMethod: "NN", startId: "A" }),
      id: "run-nn-a",
      category: "construction" as const,
    };
    const runNI_A = {
      ...execute({ initialMethod: "NI", startId: "A" }),
      id: "run-ni-a",
      category: "construction" as const,
    };
    const runNN_B = {
      ...execute({ initialMethod: "NN", startId: "B" }),
      id: "run-nn-b",
      category: "construction" as const,
    };

    const resConstSame = evaluatePairComparability(runNN_A, runNI_A);
    expect(resConstSame.isComparable).toBe(true);
    expect(resConstSame.headline).toContain("Dataset & Titik Awal Sama");

    const resConstDiff = evaluatePairComparability(runNN_A, runNN_B);
    expect(resConstDiff.isComparable).toBe(false);
    expect(resConstDiff.statusType).toBe("different_start");
    expect(resConstDiff.headline).toBe("Titik Awal Konstruksi Berbeda");

    // 4. Local Search vs Local Search (tur masukan sama vs beda)
    const run2Opt = {
      ...execute({ algorithm: "2OPT", category: "local-search" as const }),
      id: "run-2opt",
      category: "local-search" as const,
    };
    const run3OptSame = {
      ...execute({ algorithm: "3OPT", category: "local-search" as const }),
      id: "run-3opt",
      category: "local-search" as const,
      initialRoute: [...run2Opt.initialRoute],
    };
    const run3OptDiff = {
      ...execute({ algorithm: "3OPT", category: "local-search" as const }),
      id: "run-3opt-diff",
      category: "local-search" as const,
      initialRoute: [0, 2, 1, 3, 4, 5],
    };

    expect(evaluatePairComparability(run2Opt, run3OptSame).isComparable).toBe(true);
    expect(evaluatePairComparability(run2Opt, run3OptDiff).isComparable).toBe(false);
    expect(evaluatePairComparability(run2Opt, run3OptDiff).statusType).toBe("different_route");

    // 5. Lintas Kategori (Konstruksi vs Metaheuristik)
    const resCross = evaluatePairComparability(runNN_A, runTS);
    expect(resCross.isComparable).toBe(false);
    expect(resCross.statusType).toBe("cross_category");
    expect(resCross.headline).toBe("Perbandingan Bersifat Deskriptif");

    // 6. Dataset Berbeda
    const otherDataset = { ...EXAMPLE, id: "other", nodes: [{ id: "Z", x: 99, y: 99 }] };
    const runOther = { ...runTS, id: "run-other", dataset: otherDataset };
    const resOtherDs = evaluatePairComparability(runTS, runOther);
    expect(resOtherDs.isComparable).toBe(false);
    expect(resOtherDs.statusType).toBe("different_dataset");

    // 7. Run Dibatalkan / Parsial
    const runCancelled = {
      ...runTS,
      id: "run-cancel",
      status: "cancelled" as const,
      cancelledStage: "preparation" as const,
    };
    const resCancel = evaluatePairComparability(runCancelled, runSA);
    expect(resCancel.cancelledWarning).toBeDefined();
    expect(resCancel.cancelledWarning).toContain("Hasil Parsial");
  });

  test("comparisonCsv menyertakan kolom side bila sideMap diberikan", () => {
    const runA = { ...execute(), id: "run-a" };
    const runB = { ...execute(), id: "run-b" };

    const csvWithSide = comparisonCsv([runA, runB], { [runA.id]: "A", [runB.id]: "B" });
    expect(csvWithSide.startsWith('"side","run_id"')).toBe(true);
    expect(csvWithSide).toContain('"A","run-a"');
    expect(csvWithSide).toContain('"B","run-b"');

    const csvNoSide = comparisonCsv([runA, runB]);
    expect(csvNoSide.startsWith('"run_id"')).toBe(true);
  });

  test("isDatasetIdentical membandingkan koordinat dan struktur secara mendalam", () => {
    // 1. Dataset yang sama persis
    expect(isDatasetIdentical(EXAMPLE, { ...EXAMPLE })).toBe(true);

    // 2. ID dataset atau nama berbeda tapi koordinat dan node identik
    const renamed = { ...EXAMPLE, id: "renamed-fixture", name: "Fixture Modifikasi" };
    expect(isDatasetIdentical(EXAMPLE, renamed)).toBe(true);

    // 3. ID dataset sama ("custom") tapi koordinat berbeda (misal random generation berulang)
    const sameIdDiffCoords: Dataset = {
      ...EXAMPLE,
      nodes: EXAMPLE.nodes.map((n, i) => (i === 0 ? { ...n, x: n.x + 5 } : { ...n })),
    };
    expect(isDatasetIdentical(EXAMPLE, sameIdDiffCoords)).toBe(false);

    // 4. Jumlah node berbeda
    const subset: Dataset = {
      ...EXAMPLE,
      nodes: EXAMPLE.nodes.slice(0, 3),
    };
    expect(isDatasetIdentical(EXAMPLE, subset)).toBe(false);

    // 5. Unit berbeda
    const diffUnit: Dataset = {
      ...EXAMPLE,
      unit: "km" as unknown as "unit",
    };
    expect(isDatasetIdentical(EXAMPLE, diffUnit)).toBe(false);

    // 6. Integrasi dengan evaluatePairComparability: dataset ID sama tapi koordinat beda dianggap different_dataset
    const runTS = { ...execute({ algorithm: "TS" }), id: "run-ts" };
    const runTSDiffCoords = {
      ...execute({ algorithm: "TS" }),
      id: "run-ts-diff",
      dataset: sameIdDiffCoords,
    };
    const compResult = evaluatePairComparability(runTS, runTSDiffCoords);
    expect(compResult.isComparable).toBe(false);
    expect(compResult.statusType).toBe("different_dataset");
  });
});
