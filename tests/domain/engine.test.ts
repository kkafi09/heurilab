import { describe, expect, test } from "bun:test";
import {
  EXAMPLE,
  closedRoute,
  distanceMatrix,
  routeCost,
  validateDataset,
  validateRoute,
  type Dataset,
  type Route,
} from "../../src/domain/tsp/model";
import {
  applyMove,
  moveDelta,
  moveEdges,
  nearestInsertion,
  nearestNeighbor,
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
      { seed: -1 },
      { coolingRate: 1 },
      { tenure: 0 },
      { startId: "absent" },
      { initialTemperature: Infinity },
      { minimumTemperature: 100 },
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
    expect(makeInitialRoute(EXAMPLE, { ...defaultConfig, improve: true })).toEqual(
      twoOptDescent(nearestNeighbor(EXAMPLE.nodes, matrix, 0), matrix),
    );
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
  test("sesi valid dapat dipulihkan dan sesi korup ditolak", () => {
    const run = execute({ algorithm: "SA", maxIterations: 10 }),
      session = { version: 1, dataset: EXAMPLE, config: defaultConfig, runs: [run] };
    expect(parseSession(session).runs[0]!.bestRoute).toEqual(run.bestRoute);
    expect(() => parseSession({ version: 9 })).toThrow();
    expect(() =>
      parseSession({
        ...session,
        runs: [{ ...run, trace: [{ ...run.trace[0], move: { i: 99, j: 100 } }] }],
      }),
    ).toThrow();
    expect(() =>
      parseSession({ ...session, config: { ...defaultConfig, maxIterations: NaN } }),
    ).toThrow();
  });
  test("CSV memuat konfigurasi, unit, rute, dan quoting aman", () => {
    const run = execute();
    run.dataset = { ...run.dataset, name: '=demo,"quoted"' };
    const csv = comparisonCsv([run]);
    expect(csv).toContain("parameters");
    expect(csv).toContain("euclidean");
    expect(csv).toContain("unit koordinat");
    expect(csv).toContain("A →");
    expect(csv).toContain("'=demo");
    expect(csv).toContain('""quoted""');
  });
});
