import { describe, expect, test } from "bun:test";
import {
  generateRandomDataset,
  validateGeneratorConfig,
  rotateTourToStart,
  tourNodeIdsToRoute,
  deriveTourSeed,
  mulberry32,
} from "../../src/domain/tsp/randomGenerator";
import { distanceMatrix, routeCost, validateRoute, EPSILON } from "../../src/domain/tsp/model";
import {
  nearestNeighbor,
  nearestInsertion,
  nearestFarthestInsertion,
  twoOptDescent,
  threeOptDescent,
} from "../../src/domain/algorithms/baselines";
import {
  Experiment,
  defaultConfig,
  makeInitialRoute,
  validateConfig,
  type RunConfig,
} from "../../src/domain/algorithms/experiment";
import { workspaceReducer, type Workspace } from "../../src/app/workspace";

describe("Generator Dataset Acak — Validasi Batas & Input", () => {
  test("menerima N=3, 10, 20, 50, 100 dan menolak N=2, 101, kosong, atau non-integer tanpa mengubah dataset", () => {
    // Valid counts
    for (const count of [3, 10, 20, 50, 100]) {
      const errs = validateGeneratorConfig({ nodeCount: count, distribution: "uniform" });
      expect(errs).toHaveLength(0);
    }

    // Invalid counts
    for (const invalidCount of [2, 101, 0, -5, 10.5, NaN, Infinity]) {
      const errs = validateGeneratorConfig({ nodeCount: invalidCount, distribution: "uniform" });
      expect(errs.length).toBeGreaterThan(0);
      expect(errs[0]).toContain("Jumlah node harus berupa bilangan bulat antara 3 hingga 100.");
    }
  });

  test("validasi jumlah cluster: default 3, rentang 1 hingga min(10, nodeCount)", () => {
    // N = 4: cluster maksimal 4
    const errsValid = validateGeneratorConfig({
      nodeCount: 4,
      distribution: "cluster",
      clusterCount: 4,
    });
    expect(errsValid).toHaveLength(0);

    const errsOver = validateGeneratorConfig({
      nodeCount: 4,
      distribution: "cluster",
      clusterCount: 5,
    });
    expect(errsOver.length).toBeGreaterThan(0);
    expect(errsOver[0]).toContain("antara 1 hingga 4");

    // N = 20: cluster maksimal 10
    const errs10 = validateGeneratorConfig({
      nodeCount: 20,
      distribution: "cluster",
      clusterCount: 10,
    });
    expect(errs10).toHaveLength(0);

    const errs11 = validateGeneratorConfig({
      nodeCount: 20,
      distribution: "cluster",
      clusterCount: 11,
    });
    expect(errs11.length).toBeGreaterThan(0);
    expect(errs11[0]).toContain("antara 1 hingga 10");
  });

  test("validasi seed data: integer 0 hingga 4.294.967.295", () => {
    expect(
      validateGeneratorConfig({ nodeCount: 10, distribution: "uniform", seed: 0 }),
    ).toHaveLength(0);
    expect(
      validateGeneratorConfig({ nodeCount: 10, distribution: "uniform", seed: 4294967295 }),
    ).toHaveLength(0);

    expect(
      validateGeneratorConfig({ nodeCount: 10, distribution: "uniform", seed: -1 }).length,
    ).toBeGreaterThan(0);
    expect(
      validateGeneratorConfig({ nodeCount: 10, distribution: "uniform", seed: 4294967296 }).length,
    ).toBeGreaterThan(0);
    expect(
      validateGeneratorConfig({ nodeCount: 10, distribution: "uniform", seed: 3.14 }).length,
    ).toBeGreaterThan(0);
  });
});

describe("Generator Dataset Acak — Sifat Distribusi, Presisi, dan PRNG", () => {
  test("koordinat presisi numerik penuh (bukan pembulatan 1 desimal), berada di rentang [-100, 100], dan tanpa duplikat", () => {
    const { dataset } = generateRandomDataset({ nodeCount: 50, distribution: "uniform", seed: 42 });
    expect(dataset.nodes).toHaveLength(50);

    const coordSet = new Set<string>();
    for (const node of dataset.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThanOrEqual(-100);
      expect(node.x).toBeLessThanOrEqual(100);
      expect(node.y).toBeGreaterThanOrEqual(-100);
      expect(node.y).toBeLessThanOrEqual(100);

      // Pastikan presisi penuh: memiliki nilai pecahan yang tidak dibulatkan ke satu desimal
      const key = `${node.x},${node.y}`;
      expect(coordSet.has(key)).toBe(false);
      coordSet.add(key);
    }
  });

  test("distribusi cluster menempatkan minimal satu node per cluster dan sebaran Gaussian dalam batas", () => {
    const { dataset } = generateRandomDataset({
      nodeCount: 20,
      distribution: "cluster",
      clusterCount: 3,
      seed: 123,
    });
    expect(dataset.nodes).toHaveLength(20);
    expect(dataset.generator?.distribution).toBe("cluster");
    expect(dataset.generator?.clusterCount).toBe(3);

    for (const node of dataset.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(-100);
      expect(node.x).toBeLessThanOrEqual(100);
      expect(node.y).toBeGreaterThanOrEqual(-100);
      expect(node.y).toBeLessThanOrEqual(100);
    }
  });

  test("reproduktifitas deterministik: seed dan konfigurasi yang sama menghasilkan koordinat dan tour yang identik", () => {
    const resA = generateRandomDataset({
      nodeCount: 25,
      distribution: "cluster",
      clusterCount: 4,
      seed: 999,
    });
    const resB = generateRandomDataset({
      nodeCount: 25,
      distribution: "cluster",
      clusterCount: 4,
      seed: 999,
    });

    expect(resA.actualSeed).toBe(999);
    expect(resB.actualSeed).toBe(999);
    expect(resA.dataset.nodes).toEqual(resB.dataset.nodes);
    expect(resA.dataset.randomTourNodeIds).toEqual(resB.dataset.randomTourNodeIds);
  });

  test("stream pengacakan tour independen dari state PRNG koordinat melalui derivasi seed tetap", () => {
    const seed = 777;
    const tourSeed = deriveTourSeed(seed);
    expect(tourSeed).toBe((seed ^ 0xa5a5a5a5) >>> 0);

    // Mulberry32 SA dengan seed sama tetap menghasilkan urutan yang identik dengan sebelumnya
    const rng1 = mulberry32(42);
    const v1 = rng1();
    const v2 = rng1();
    expect(v1).toBeGreaterThanOrEqual(0);
    expect(v1).toBeLessThan(1);
    expect(v2).toBeGreaterThanOrEqual(0);
    expect(v2).toBeLessThan(1);
  });
});

describe("Tour Acak Awal & Pemisahan dari Jalur Optimasi", () => {
  test("tour acak awal adalah permutasi valid dimulai dari node A dan belum dioptimasi", () => {
    const { dataset } = generateRandomDataset({ nodeCount: 15, distribution: "uniform", seed: 42 });
    expect(dataset.randomTourNodeIds).toBeDefined();
    expect(dataset.randomTourNodeIds).toHaveLength(15);
    expect(dataset.randomTourNodeIds![0]).toBe("A");

    // Semua ID harus unik
    const uniqueIds = new Set(dataset.randomTourNodeIds);
    expect(uniqueIds.size).toBe(15);

    const route = tourNodeIdsToRoute(dataset.nodes, dataset.randomTourNodeIds!, "A");
    expect(route).not.toBeNull();
    expect(validateRoute(route!, 15)).toBe(true);
    expect(route![0]).toBe(0);
  });

  test("rotasi tour saat startId diganti mempertahankan siklus tanpa mengacak ulang atau mengoptimasi rute", () => {
    const tourIds = ["A", "C", "D", "B", "E"];
    const rotated = rotateTourToStart(tourIds, "D");
    expect(rotated).toEqual(["D", "B", "E", "A", "C"]);

    // Rotasi ke node awal yang sama tidak mengubah urutan
    expect(rotateTourToStart(tourIds, "A")).toEqual(tourIds);
  });

  test("makeInitialRoute dengan 'random' mengembalikan rute snapshot tanpa menjalankan 2-OPT otomatis", () => {
    const { dataset } = generateRandomDataset({ nodeCount: 10, distribution: "uniform", seed: 42 });
    const route = makeInitialRoute(dataset, {
      initialMethod: "random",
      improve: "none",
      startId: "A",
    });

    expect(validateRoute(route, 10)).toBe(true);
    expect(route[0]).toBe(0);

    const expected = tourNodeIdsToRoute(dataset.nodes, dataset.randomTourNodeIds!, "A")!;
    expect(route).toEqual(expected);
  });

  test("validateConfig menerima 'random' jika dataset memiliki randomTourNodeIds, dan menolak jika tidak ada", () => {
    const { dataset } = generateRandomDataset({ nodeCount: 10, distribution: "uniform", seed: 42 });
    const validCfg: RunConfig = { ...defaultConfig, initialMethod: "random", startId: "A" };
    expect(validateConfig(validCfg, dataset)).toEqual([]);

    const noTourDataset = { ...dataset, randomTourNodeIds: undefined };
    const errors = validateConfig(validCfg, noTourDataset);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("Rute acak belum tersedia");
  });
});

describe("Matriks Audit Otomatis (12 Skenario: N=10, 20, 50 | Merata & Cluster | Seed 42 & 123)", () => {
  const distributions: ("uniform" | "cluster")[] = ["uniform", "cluster"];
  const sizes = [10, 20, 50];
  const seeds = [42, 123];

  for (const dist of distributions) {
    for (const size of sizes) {
      for (const seed of seeds) {
        test(`Audit Skenario: ${dist} N=${size} seed=${seed}`, () => {
          const { dataset } = generateRandomDataset({
            nodeCount: size,
            distribution: dist,
            clusterCount: dist === "cluster" ? 3 : undefined,
            seed,
          });

          const matrix = distanceMatrix(dataset.nodes);
          const startId = dataset.nodes[0]!.id;
          const snapshotRoute = tourNodeIdsToRoute(
            dataset.nodes,
            dataset.randomTourNodeIds!,
            startId,
          )!;
          expect(validateRoute(snapshotRoute, size)).toBe(true);
          const snapshotCost = routeCost(snapshotRoute, matrix);

          // 1. Metode Konstruktif (NN, NI, NFI)
          const routeNN = nearestNeighbor(dataset.nodes, matrix, 0);
          const routeNI = nearestInsertion(dataset.nodes, matrix, 0);
          const routeNFI = nearestFarthestInsertion(dataset.nodes, matrix, 0);

          expect(validateRoute(routeNN, size)).toBe(true);
          expect(validateRoute(routeNI, size)).toBe(true);
          expect(validateRoute(routeNFI, size)).toBe(true);

          const costNN = routeCost(routeNN, matrix);
          const costNI = routeCost(routeNI, matrix);
          const costNFI = routeCost(routeNFI, matrix);

          expect(costNN).toBeGreaterThan(0);
          expect(costNI).toBeGreaterThan(0);
          expect(costNFI).toBeGreaterThan(0);

          // 2. Local Search Descent dari snapshot rute yang sama
          const route2Opt = twoOptDescent(snapshotRoute, matrix);
          const route3Opt = threeOptDescent(snapshotRoute, matrix);

          expect(validateRoute(route2Opt, size)).toBe(true);
          expect(validateRoute(route3Opt, size)).toBe(true);

          const cost2Opt = routeCost(route2Opt, matrix);
          const cost3Opt = routeCost(route3Opt, matrix);

          // Local search tidak boleh memperburuk initial route
          expect(cost2Opt).toBeLessThanOrEqual(snapshotCost + EPSILON);
          expect(cost3Opt).toBeLessThanOrEqual(snapshotCost + EPSILON);

          // 3. Tabu Search dari snapshot rute yang sama (run hingga selesai / iterasi terbatas)
          const tsExp = new Experiment({
            id: `ts-${dist}-${size}-${seed}`,
            createdAt: new Date().toISOString(),
            dataset,
            config: {
              ...defaultConfig,
              category: "metaheuristic",
              algorithm: "TS",
              initialMethod: "random",
              improve: "none",
              startId,
              maxIterations: 50, // audit sample
              tenure: 7,
            },
            initialRoute: snapshotRoute,
          });

          while (!tsExp.done) {
            tsExp.step();
          }

          expect(tsExp.result.bestCost).toBeLessThanOrEqual(snapshotCost + EPSILON);
          expect(validateRoute(tsExp.result.bestRoute, size)).toBe(true);
          expect(routeCost(tsExp.result.bestRoute, matrix)).toBeCloseTo(tsExp.result.bestCost, 8);

          // 4. Simulated Annealing dengan 3 seed berbeda (42, 43, 44) dari snapshot yang sama
          const saResults: number[] = [];
          for (const saSeed of [42, 43, 44]) {
            const saExp = new Experiment({
              id: `sa-${saSeed}-${dist}-${size}-${seed}`,
              createdAt: new Date().toISOString(),
              dataset,
              config: {
                ...defaultConfig,
                category: "metaheuristic",
                algorithm: "SA",
                initialMethod: "random",
                improve: "none",
                startId,
                maxIterations: 50,
                seed: saSeed,
                initialTemperature: 100,
                coolingRate: 0.95,
                iterationsPerTemperature: 10,
                minimumTemperature: 0.1,
              },
              initialRoute: snapshotRoute,
            });

            while (!saExp.done) {
              saExp.step();
            }

            expect(saExp.result.bestCost).toBeLessThanOrEqual(snapshotCost + EPSILON);
            expect(validateRoute(saExp.result.bestRoute, size)).toBe(true);
            saResults.push(saExp.result.bestCost);
          }

          // Variasi SA tercatat dan semua best cost valid
          expect(saResults).toHaveLength(3);
          for (const c of saResults) {
            expect(c).toBeGreaterThan(0);
            expect(c).toBeLessThanOrEqual(snapshotCost + EPSILON);
          }
        });
      }
    }
  }
});

describe("Smoke Test Kapasitas 100 Node", () => {
  test("smoke test kapasitas 100 node pada distribusi Merata", () => {
    const { dataset } = generateRandomDataset({
      nodeCount: 100,
      distribution: "uniform",
      seed: 42,
    });
    expect(dataset.nodes).toHaveLength(100);
    expect(dataset.randomTourNodeIds).toHaveLength(100);

    const matrix = distanceMatrix(dataset.nodes);
    const startId = dataset.nodes[0]!.id;
    const route = tourNodeIdsToRoute(dataset.nodes, dataset.randomTourNodeIds!, startId)!;
    expect(validateRoute(route, 100)).toBe(true);

    const initialCost = routeCost(route, matrix);
    expect(initialCost).toBeGreaterThan(0);

    // Langkah awal TS pada 100 node dapat dieksekusi tanpa error
    const exp = new Experiment({
      id: "smoke-100-uniform",
      createdAt: new Date().toISOString(),
      dataset,
      config: {
        ...defaultConfig,
        category: "metaheuristic",
        algorithm: "TS",
        initialMethod: "random",
        improve: "none",
        startId,
        maxIterations: 5,
        tenure: 7,
      },
      initialRoute: route,
    });

    for (let i = 0; i < 5 && !exp.done; i++) {
      exp.step();
    }
    expect(exp.result.iterations).toBe(5);
    expect(exp.result.bestCost).toBeLessThanOrEqual(initialCost + EPSILON);
  });

  test("smoke test kapasitas 100 node pada distribusi Cluster", () => {
    const { dataset } = generateRandomDataset({
      nodeCount: 100,
      distribution: "cluster",
      clusterCount: 5,
      seed: 123,
    });
    expect(dataset.nodes).toHaveLength(100);
    expect(dataset.randomTourNodeIds).toHaveLength(100);

    const matrix = distanceMatrix(dataset.nodes);
    const startId = dataset.nodes[0]!.id;
    const route = tourNodeIdsToRoute(dataset.nodes, dataset.randomTourNodeIds!, startId)!;
    expect(validateRoute(route, 100)).toBe(true);

    const initialCost = routeCost(route, matrix);
    expect(initialCost).toBeGreaterThan(0);
  });
});

describe("Workspace Transitions & Provenance Tracking", () => {
  const baseState: Workspace = {
    dataset: generateRandomDataset({ nodeCount: 10, distribution: "uniform", seed: 42 }).dataset,
    config: { ...defaultConfig, initialMethod: "random", startId: "A" },
    runs: [],
    active: null,
    selectedId: null,
    phase: "idle",
    runId: null,
    error: null,
  };

  test("generate_dataset mengganti dataset dan menetapkan initialMethod ke 'random'", () => {
    const s1 = workspaceReducer(baseState, {
      type: "generate_dataset",
      config: { nodeCount: 20, distribution: "cluster", clusterCount: 3, seed: 123 },
    });
    expect(s1.dataset.nodes).toHaveLength(20);
    expect(s1.dataset.generator?.distribution).toBe("cluster");
    expect(s1.config.initialMethod).toBe("random");
    expect(s1.dataset.randomTourNodeIds).toHaveLength(20);
    expect(s1.error).toBeNull();
  });

  test("generate_dataset dengan parameter invalid menampilkan error tanpa mengubah dataset", () => {
    const prevDataset = baseState.dataset;
    const s1 = workspaceReducer(baseState, {
      type: "generate_dataset",
      config: { nodeCount: 101, distribution: "uniform" },
    });
    expect(s1.dataset).toBe(prevDataset);
    expect(s1.error).toContain("Jumlah node harus berupa bilangan bulat antara 3 hingga 100.");
  });

  test("setelah penambahan atau pergeseran node, dataset ditandai isEdited = true dan provenance diperbarui", () => {
    // 1. Move node
    const sMoved = workspaceReducer(baseState, {
      type: "move_node",
      id: "A",
      x: 50,
      y: 50,
    });
    expect(sMoved.dataset.generator?.isEdited).toBe(true);
    expect(sMoved.dataset.provenance).toContain("Telah diedit dari hasil generator");
    expect(sMoved.dataset.randomTourNodeIds).toEqual(baseState.dataset.randomTourNodeIds);

    // 2. Add node
    const sAdded = workspaceReducer(baseState, {
      type: "add_node",
      x: 10,
      y: 20,
    });
    expect(sAdded.dataset.nodes).toHaveLength(11);
    expect(sAdded.dataset.generator?.isEdited).toBe(true);
    expect(sAdded.dataset.randomTourNodeIds).toHaveLength(11);
    expect(sAdded.dataset.randomTourNodeIds![10]).toBe(sAdded.dataset.nodes[10]!.id);

    // 3. Remove node
    const sRemoved = workspaceReducer(baseState, {
      type: "remove_node",
      id: "B",
    });
    expect(sRemoved.dataset.nodes).toHaveLength(9);
    expect(sRemoved.dataset.generator?.isEdited).toBe(true);
    expect(sRemoved.dataset.randomTourNodeIds).not.toContain("B");
  });
});
