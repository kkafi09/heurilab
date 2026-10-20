import type { Dataset, Route, TspNode } from "./model";

export type GeneratorDistribution = "uniform" | "cluster";

export interface GeneratorConfig {
  nodeCount: number;
  distribution: GeneratorDistribution;
  clusterCount?: number;
  seed?: number;
}

export interface GeneratorResult {
  dataset: Dataset;
  actualSeed: number;
}

/**
 * PRNG deterministik Mulberry32 32-bit uint.
 * Menghasilkan angka float [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derivasi seed deterministik untuk stream pengacakan rute (tour).
 * Terpisah dari stream pengambilan koordinat agar tidak saling mengonsumsi state.
 */
export function deriveTourSeed(dataSeed: number): number {
  return (dataSeed ^ 0xa5a5a5a5) >>> 0;
}

/**
 * Validasi parameter generator dataset.
 */
export function validateGeneratorConfig(config: GeneratorConfig): string[] {
  const errors: string[] = [];
  if (
    typeof config.nodeCount !== "number" ||
    !Number.isInteger(config.nodeCount) ||
    config.nodeCount < 3 ||
    config.nodeCount > 100
  ) {
    errors.push("Jumlah node harus berupa bilangan bulat antara 3 hingga 100.");
  }

  if (config.distribution !== "uniform" && config.distribution !== "cluster") {
    errors.push("Distribusi harus berupa Merata (uniform) atau Cluster.");
  }

  if (config.distribution === "cluster") {
    const maxClusters = Math.min(10, Number.isInteger(config.nodeCount) ? config.nodeCount : 10);
    const clusterCount = config.clusterCount ?? 3;
    if (
      typeof clusterCount !== "number" ||
      !Number.isInteger(clusterCount) ||
      clusterCount < 1 ||
      clusterCount > maxClusters
    ) {
      errors.push(`Jumlah cluster harus berupa bilangan bulat antara 1 hingga ${maxClusters}.`);
    }
  }

  if (config.seed !== undefined) {
    if (
      typeof config.seed !== "number" ||
      !Number.isInteger(config.seed) ||
      config.seed < 0 ||
      config.seed > 4294967295
    ) {
      errors.push("Seed data harus berupa bilangan bulat 0–4.294.967.295.");
    }
  }

  return errors;
}

/**
 * Memutar snapshot urutan ID rute agar titik awal (startId) berada di posisi pertama
 * tanpa mengubah urutan siklus atau mengoptimasi rute.
 */
export function rotateTourToStart(tourNodeIds: string[], startId: string): string[] {
  const idx = tourNodeIds.indexOf(startId);
  if (idx <= 0) return [...tourNodeIds];
  return [...tourNodeIds.slice(idx), ...tourNodeIds.slice(0, idx)];
}

/**
 * Mengonversi array ID node rute ke array indeks numerik [0..N-1].
 * Mengembalikan null jika ada ID yang tidak cocok atau panjang tidak sesuai.
 */
export function tourNodeIdsToRoute(
  nodes: TspNode[],
  tourNodeIds: string[],
  startId?: string,
): Route | null {
  if (nodes.length !== tourNodeIds.length) return null;
  const idToIdx = new Map(nodes.map((n, i) => [n.id, i]));
  const orderedIds = startId ? rotateTourToStart(tourNodeIds, startId) : tourNodeIds;
  const route: number[] = [];
  const visited = new Set<number>();

  for (const id of orderedIds) {
    const idx = idToIdx.get(id);
    if (idx === undefined || visited.has(idx)) return null;
    visited.add(idx);
    route.push(idx);
  }

  return route.length === nodes.length ? route : null;
}

/**
 * Pembangkit dataset acak hingga 100 node dengan distribusi Merata atau Cluster.
 * Menghasilkan koordinat planar presisi penuh dalam rentang [-100, 100]
 * serta snapshot rute acak awal yang belum dioptimasi (Fisher–Yates shuffle).
 */
function getNodeId(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : `N${i + 1}`;
}

export function generateRandomDataset(config: GeneratorConfig): GeneratorResult {
  const errors = validateGeneratorConfig(config);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  let actualSeed: number;
  if (config.seed !== undefined) {
    actualSeed = config.seed >>> 0;
  } else {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    actualSeed = arr[0]!;
  }

  const coordPrng = mulberry32(actualSeed);
  const tourPrng = mulberry32(deriveTourSeed(actualSeed));

  const nodes: TspNode[] = [];
  const isDuplicate = (x: number, y: number): boolean => {
    return nodes.some((n) => Math.abs(n.x - x) < 1e-9 && Math.abs(n.y - y) < 1e-9);
  };

  if (config.distribution === "uniform") {
    for (let i = 0; i < config.nodeCount; i++) {
      let attempts = 0;
      let x = 0;
      let y = 0;
      let found = false;

      while (attempts < 1000) {
        attempts++;
        x = -100 + coordPrng() * 200;
        y = -100 + coordPrng() * 200;
        if (!isDuplicate(x, y)) {
          found = true;
          break;
        }
      }

      if (!found) {
        throw new Error("Gagal membangkitkan node unik setelah 1000 percobaan.");
      }

      nodes.push({ id: getNodeId(i), x, y });
    }
  } else {
    // Distribusi Cluster
    const clusterCount = config.clusterCount ?? 3;
    const centers: { x: number; y: number }[] = [];

    for (let c = 0; c < clusterCount; c++) {
      centers.push({
        x: -60 + coordPrng() * 120,
        y: -60 + coordPrng() * 120,
      });
    }

    // Setiap cluster minimal mendapatkan 1 node, sisa node dialokasikan acak
    const assignments: number[] = [];
    for (let c = 0; c < clusterCount; c++) {
      assignments.push(c);
    }
    for (let i = clusterCount; i < config.nodeCount; i++) {
      assignments.push(Math.floor(coordPrng() * clusterCount));
    }

    for (let i = 0; i < config.nodeCount; i++) {
      const center = centers[assignments[i]!]!;
      let attempts = 0;
      let x = 0;
      let y = 0;
      let found = false;

      while (attempts < 1000) {
        attempts++;
        // Box-Muller transform untuk sebaran Gaussian (std dev 12)
        let u1 = coordPrng();
        while (u1 <= 1e-15) u1 = coordPrng();
        const u2 = coordPrng();
        const r = Math.sqrt(-2.0 * Math.log(u1));
        const theta = 2.0 * Math.PI * u2;
        x = center.x + r * Math.cos(theta) * 12;
        y = center.y + r * Math.sin(theta) * 12;

        // Ambil sampel ulang jika di luar batas [-100, 100] (bukan memotong/clamping)
        if (x >= -100 && x <= 100 && y >= -100 && y <= 100 && !isDuplicate(x, y)) {
          found = true;
          break;
        }
      }

      if (!found) {
        throw new Error("Gagal membangkitkan node unik setelah 1000 percobaan.");
      }

      nodes.push({ id: getNodeId(i), x, y });
    }
  }

  // Permutasi tour acak Fisher–Yates: pertahankan titik awal (nodes[0]) di depan
  const startId = nodes[0]!.id;
  const remainingIds = nodes.slice(1).map((n) => n.id);
  for (let i = remainingIds.length - 1; i > 0; i--) {
    const j = Math.floor(tourPrng() * (i + 1));
    const temp = remainingIds[i]!;
    remainingIds[i] = remainingIds[j]!;
    remainingIds[j] = temp;
  }
  const randomTourNodeIds = [startId, ...remainingIds];

  const datasetName =
    config.distribution === "cluster"
      ? `Cluster ${config.nodeCount} node (${config.clusterCount ?? 3} cluster)`
      : `Merata ${config.nodeCount} node`;

  const provenance =
    config.distribution === "cluster"
      ? `Sintetis Cluster: ${config.nodeCount} node, ${config.clusterCount ?? 3} cluster, seed data ${actualSeed}. Rentang [-100, 100], simpangan baku 12.`
      : `Sintetis Merata: ${config.nodeCount} node, seed data ${actualSeed}. Rentang [-100, 100].`;

  const dataset: Dataset = {
    id: crypto.randomUUID(),
    name: datasetName,
    nodes,
    unit: "unit",
    provenance,
    generator: {
      version: 1,
      distribution: config.distribution,
      nodeCount: config.nodeCount,
      seed: actualSeed,
      clusterCount: config.distribution === "cluster" ? (config.clusterCount ?? 3) : undefined,
      bounds: { minX: -100, maxX: 100, minY: -100, maxY: 100 },
      isEdited: false,
    },
    randomTourNodeIds,
  };

  return { dataset, actualSeed };
}
