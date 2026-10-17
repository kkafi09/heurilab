import {
  distanceMatrix,
  EPSILON,
  routeCost,
  validateDataset,
  validateRoute,
  type Dataset,
  type Route,
  type DistanceMatrix,
} from "../tsp/model";
export { EPSILON };
import {
  applyMove,
  moveDelta,
  moveEdges,
  nearestFarthestInsertion,
  nearestInsertion,
  nearestNeighbor,
  threeOptDescent,
  twoOptDescent,
  twoOptMoves,
  type Move,
} from "./baselines";

export type ExperimentCategory = "construction" | "local-search" | "metaheuristic";
export type RunCategory = ExperimentCategory;
export type RunSnapshot = Omit<RunResult, "trace">;
export type InitialMethod = "NN" | "NI" | "NFI";
export type ImprovementMethod = "none" | "2OPT" | "3OPT";
export type AlgorithmType = "TS" | "SA" | "2OPT" | "3OPT" | "NN" | "NI" | "NFI";

export interface StageDurations {
  constructionMs?: number;
  preparationMs?: number;
  searchMs?: number;
  totalMs: number;
}

export interface RunConfig {
  category: ExperimentCategory;
  algorithm: AlgorithmType;
  initialMethod: InitialMethod;
  improve: ImprovementMethod;
  startId: string;
  maxIterations: number;
  seed: number;
  tenure: number;
  initialTemperature: number;
  coolingRate: number;
  iterationsPerTemperature: number;
  minimumTemperature: number;
}

export const defaultConfig: RunConfig = {
  category: "metaheuristic",
  algorithm: "TS",
  initialMethod: "NN",
  improve: "none",
  startId: "A",
  maxIterations: 2000,
  seed: 42,
  tenure: 7,
  initialTemperature: 100,
  coolingRate: 0.95,
  iterationsPerTemperature: 20,
  minimumTemperature: 0.001,
};

export interface TraceStep {
  iteration: number;
  move: Move;
  candidateCost: number;
  currentCost: number;
  bestCost: number;
  delta: number;
  accepted: boolean;
  reason: string;
  tabu?: boolean;
  aspiration?: boolean;
  tabuEdges?: [string, number][];
  temperature?: number;
  probability?: number;
  draw?: number;
}

export type StopReason =
  | "iteration-limit"
  | "minimum-temperature"
  | "no-eligible"
  | "empty-neighborhood"
  | "cancelled"
  | "no-improvement"
  | "step-limit"
  | "completed";

export interface RunResult {
  id: string;
  createdAt: string;
  category: ExperimentCategory;
  dataset: Dataset;
  config: RunConfig;
  initialRoute: Route;
  initialCost: number;
  currentRoute: Route;
  currentCost: number;
  bestRoute: Route;
  bestCost: number;
  trace: TraceStep[];
  iterations: number;
  evaluations: number;
  durationMs: number;
  durations?: StageDurations;
  status: "completed" | "cancelled";
  stopReason: StopReason;
  cancelledStage?: "construction" | "preparation" | "search";
  preparationSteps?: number;
  preparationEvaluations?: number;
  initialRouteSource?: "computed" | "snapshot";
}

export interface RunInput {
  id: string;
  createdAt: string;
  dataset: Dataset;
  config: RunConfig;
  initialRoute?: Route;
  durations?: StageDurations;
  initialRouteSource?: "computed" | "snapshot";
}

export function validateConfig(config: RunConfig, dataset: Dataset): string[] {
  const errors: string[] = [];
  const category = config.category ?? "metaheuristic";
  if (!["construction", "local-search", "metaheuristic"].includes(category)) {
    errors.push("Kategori eksperimen tidak valid.");
  }
  if (!["NN", "NI", "NFI"].includes(config.initialMethod)) {
    errors.push("Metode solusi awal tidak valid.");
  }
  const improveChoice =
    typeof config.improve === "boolean" ? (config.improve ? "2OPT" : "none") : config.improve;
  if (!["none", "2OPT", "3OPT"].includes(improveChoice)) {
    errors.push("Pilihan perbaikan tidak valid.");
  }
  if (!dataset.nodes.some((node) => node.id === config.startId)) {
    errors.push("Titik awal tidak ada di dataset.");
  }

  if (category === "metaheuristic") {
    if (!["TS", "SA"].includes(config.algorithm)) {
      errors.push("Metode optimasi tidak valid.");
    }
    if (
      !Number.isInteger(config.maxIterations) ||
      config.maxIterations < 1 ||
      config.maxIterations > 10000
    ) {
      errors.push("Batas iterasi harus 1–10.000.");
    }
    if (config.algorithm === "TS") {
      if (!Number.isInteger(config.tenure) || config.tenure < 1 || config.tenure > 100) {
        errors.push("Tabu tenure harus 1–100.");
      }
    }
    if (config.algorithm === "SA") {
      if (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 4294967295) {
        errors.push("Seed harus integer 0–4.294.967.295.");
      }
      if (!Number.isFinite(config.initialTemperature) || config.initialTemperature <= 0) {
        errors.push("Suhu awal harus positif dan finite.");
      }
      if (
        !Number.isFinite(config.coolingRate) ||
        config.coolingRate <= 0 ||
        config.coolingRate >= 1
      ) {
        errors.push("Cooling rate harus lebih dari 0 dan kurang dari 1.");
      }
      if (
        !Number.isInteger(config.iterationsPerTemperature) ||
        config.iterationsPerTemperature < 1 ||
        config.iterationsPerTemperature > 10000
      ) {
        errors.push("Iterasi per suhu harus 1–10.000.");
      }
      if (
        !Number.isFinite(config.minimumTemperature) ||
        config.minimumTemperature <= 0 ||
        config.minimumTemperature >= config.initialTemperature
      ) {
        errors.push("Suhu minimum harus positif dan lebih kecil dari suhu awal.");
      }
    }
  } else if (category === "local-search") {
    if (!["2OPT", "3OPT"].includes(config.algorithm)) {
      errors.push("Metode local search harus 2-OPT atau 3-OPT.");
    }
  } else if (category === "construction") {
    if (!["NN", "NI", "NFI"].includes(config.algorithm)) {
      errors.push("Metode konstruktif tidak valid.");
    }
  }
  return errors;
}

export function makeInitialRoute(
  dataset: Dataset,
  config: { initialMethod: InitialMethod; improve: ImprovementMethod | boolean; startId: string },
): Route {
  const issues = validateDataset(dataset);
  if (issues.length) {
    throw new Error(issues.map((i) => i.message).join(" "));
  }
  const matrix = distanceMatrix(dataset.nodes),
    start = dataset.nodes.findIndex((node) => node.id === config.startId);
  if (start < 0) {
    throw new Error("Titik awal tidak ada di dataset.");
  }
  let route: Route;
  if (config.initialMethod === "NN") {
    route = nearestNeighbor(dataset.nodes, matrix, start);
  } else if (config.initialMethod === "NI") {
    route = nearestInsertion(dataset.nodes, matrix, start);
  } else if (config.initialMethod === "NFI") {
    route = nearestFarthestInsertion(dataset.nodes, matrix, start);
  } else {
    route = nearestNeighbor(dataset.nodes, matrix, start);
  }

  const improveChoice =
    typeof config.improve === "boolean" ? (config.improve ? "2OPT" : "none") : config.improve;
  if (improveChoice === "2OPT") return twoOptDescent(route, matrix);
  if (improveChoice === "3OPT") return threeOptDescent(route, matrix);
  return route;
}

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
export function acceptanceProbability(delta: number, temperature: number): number {
  return delta <= 0 ? 1 : Math.exp(-delta / temperature);
}
export function isTabu(added: string[], tabu: Map<string, number>, iteration: number): boolean {
  return added.some((edge) => (tabu.get(edge) ?? -1) >= iteration);
}
export function aspirationAllowed(candidateCost: number, bestCost: number): boolean {
  return candidateCost < bestCost - EPSILON;
}

// A synchronous, UI-free state machine. The worker schedules batches and injects cancellation.
export class Experiment {
  readonly matrix: DistanceMatrix;
  readonly moves: Move[];
  readonly random: () => number;
  readonly result: RunResult;
  readonly tabu = new Map<string, number>();
  temperature: number;
  done = false;
  constructor(input: RunInput) {
    const initial = input.initialRoute
      ? [...input.initialRoute]
      : makeInitialRoute(input.dataset, input.config);
    const route = [...initial];
    if (!validateRoute(route, input.dataset.nodes.length))
      throw new Error("Initial route tidak valid.");
    this.matrix = distanceMatrix(input.dataset.nodes);
    this.moves = twoOptMoves(route.length);
    this.random = mulberry32(input.config.seed);
    this.temperature = input.config.initialTemperature;
    const cost = routeCost(route, this.matrix);
    const category = input.config.category ?? "metaheuristic";
    const improve =
      typeof input.config.improve === "boolean"
        ? input.config.improve
          ? "2OPT"
          : "none"
        : input.config.improve;

    this.result = {
      ...input,
      category,
      dataset: structuredClone(input.dataset),
      config: { ...input.config, category, improve },
      initialRoute: [...route],
      initialCost: cost,
      currentRoute: [...route],
      currentCost: cost,
      bestRoute: [...route],
      bestCost: cost,
      trace: [],
      iterations: 0,
      evaluations: 0,
      durationMs: 0,
      durations: input.durations,
      status: "completed",
      stopReason: "iteration-limit",
    };
  }
  stop(reason: StopReason) {
    this.done = true;
    this.result.stopReason = reason;
    this.result.status = reason === "cancelled" ? "cancelled" : "completed";
  }
  step(): TraceStep | undefined {
    if (this.done) return;
    const r = this.result,
      c = r.config;
    if (r.iterations >= c.maxIterations) {
      this.stop("iteration-limit");
      return;
    }
    if (!this.moves.length) {
      this.stop("empty-neighborhood");
      return;
    }
    if (c.algorithm === "SA" && this.temperature < c.minimumTemperature) {
      this.stop("minimum-temperature");
      return;
    }
    const iteration = r.iterations + 1;
    let chosen: Move | undefined,
      delta = Infinity,
      tabu = false,
      aspiration = false;
    if (c.algorithm === "TS") {
      for (const [edge, expiry] of this.tabu) if (expiry < iteration) this.tabu.delete(edge);
      for (const move of this.moves) {
        const candidateDelta = moveDelta(r.currentRoute, move, this.matrix);
        r.evaluations++;
        const blocked = isTabu(moveEdges(r.currentRoute, move).added, this.tabu, iteration);
        const allowed = blocked && aspirationAllowed(r.currentCost + candidateDelta, r.bestCost);
        if ((!blocked || allowed) && candidateDelta < delta - EPSILON) {
          chosen = move;
          delta = candidateDelta;
          tabu = blocked;
          aspiration = allowed;
        }
      }
      if (!chosen) {
        this.stop("no-eligible");
        return;
      }
    } else {
      chosen = this.moves[Math.floor(this.random() * this.moves.length)]!;
      delta = moveDelta(r.currentRoute, chosen, this.matrix);
      r.evaluations++;
    }
    const candidate = applyMove(r.currentRoute, chosen);
    const cost = routeCost(candidate, this.matrix);
    delta = cost - r.currentCost;
    const probability =
      c.algorithm === "SA" ? acceptanceProbability(delta, this.temperature) : undefined;
    const draw = c.algorithm === "SA" && delta > 0 ? this.random() : undefined;
    const accepted = c.algorithm === "TS" || delta <= 0 || draw! < probability!;
    if (c.algorithm === "TS")
      for (const edge of moveEdges(r.currentRoute, chosen).removed)
        this.tabu.set(edge, iteration + c.tenure);
    if (accepted) {
      r.currentRoute = candidate;
      r.currentCost = cost;
    }
    if (r.currentCost < r.bestCost - EPSILON) {
      r.bestCost = r.currentCost;
      r.bestRoute = [...r.currentRoute];
    }
    const step: TraceStep = {
      iteration,
      move: chosen,
      candidateCost: cost,
      currentCost: r.currentCost,
      bestCost: r.bestCost,
      delta,
      accepted,
      reason:
        c.algorithm === "TS"
          ? aspiration
            ? "Aspiration: mengalahkan best-so-far."
            : "Kandidat eligible terbaik; current boleh memburuk."
          : delta <= 0
            ? "Perbaikan atau biaya sama diterima."
            : accepted
              ? "Diterima probabilistik: draw < peluang."
              : "Ditolak: draw ≥ peluang.",
      ...(c.algorithm === "TS"
        ? { tabu, aspiration, tabuEdges: [...this.tabu] }
        : { temperature: this.temperature, probability, draw }),
    };
    r.iterations = iteration;
    r.trace.push(step);
    if (c.algorithm === "SA" && iteration % c.iterationsPerTemperature === 0)
      this.temperature *= c.coolingRate;
    return step;
  }
}
export function reconstruct(
  run: RunResult,
  index: number,
): { current: Route; candidate: Route; best: Route } {
  let current = [...run.initialRoute],
    best = [...current],
    candidate = [...current],
    bestCost = run.initialCost;
  for (const step of run.trace.slice(0, index + 1)) {
    candidate = applyMove(current, step.move);
    if (step.accepted) current = candidate;
    if (step.bestCost < bestCost - EPSILON) {
      best = [...current];
      bestCost = step.bestCost;
    }
  }
  return { current, candidate, best };
}
