import {
  Experiment,
  makeInitialRoute,
  type RunInput,
  type RunResult,
  type RunSnapshot,
  type StopReason,
} from "../domain/algorithms/experiment";
import {
  distanceMatrix,
  EPSILON,
  routeCost,
  type DistanceMatrix,
  type Route,
} from "../domain/tsp/model";
import {
  applyMove,
  applyThreeOptMove,
  moveDelta,
  threeOptDelta,
  threeOptTriples,
  twoOptMoves,
  type Move,
  type ThreeOptCase,
  type ThreeOptMove,
} from "../domain/algorithms/baselines";
import type { WorkerRequest, WorkerResponse } from "../services/protocol";

type WorkerPhase = "idle" | "preparing" | "searching";

let activeId: string | null = null,
  activeInput: RunInput | null = null,
  phase: WorkerPhase = "idle",
  paused = false,
  timer: ReturnType<typeof setTimeout> | undefined;

let started = 0,
  pausedAt = 0,
  pausedMs = 0,
  lastProgress = 0,
  sentSteps = 0;

let constructionMs = 0,
  preparationMs = 0;

// Local search / preparation state
let lsMatrix: DistanceMatrix | null = null,
  lsInitialRoute: Route = [],
  lsInitialCost = 0,
  lsCurrentRoute: Route = [],
  lsCurrentCost = 0,
  lsBestRoute: Route = [],
  lsBestCost = 0,
  lsSteps = 0,
  lsEvaluations = 0,
  lsDone = false,
  lsStopReason: StopReason = "no-improvement";

// 2-OPT LS state
let twoOptList: Move[] = [];

// 3-OPT LS state
let threeOptList: [number, number, number][] = [],
  threeOptTripleIdx = 0,
  threeOptBestMove: ThreeOptMove | undefined = undefined,
  threeOptBestDelta = -EPSILON;

// Metaheuristic search state
let engine: Experiment | undefined;

function send(message: WorkerResponse) {
  postMessage(message);
}

function elapsed() {
  return performance.now() - started - pausedMs - (paused ? performance.now() - pausedAt : 0);
}

function sendLocalSearchProgress() {
  if (!activeId || !activeInput) return;
  const dur = elapsed();
  const snapshot: RunSnapshot = {
    id: activeId,
    createdAt: activeInput.createdAt,
    category: activeInput.config.category,
    dataset: activeInput.dataset,
    config: activeInput.config,
    initialRoute: lsInitialRoute,
    initialCost: lsInitialCost,
    currentRoute: lsCurrentRoute,
    currentCost: lsCurrentCost,
    bestRoute: lsBestRoute,
    bestCost: lsBestCost,
    iterations: lsSteps,
    evaluations: lsEvaluations,
    durationMs: dur,
    durations: {
      constructionMs,
      preparationMs: phase === "preparing" ? dur : undefined,
      searchMs: phase === "searching" ? dur : undefined,
      totalMs: constructionMs + dur,
    },
    status: lsDone && lsStopReason === "cancelled" ? "cancelled" : "completed",
    stopReason: lsStopReason,
  };
  send({
    type: "progress",
    id: activeId,
    snapshot,
    steps: [],
    paused,
    stage: phase === "preparing" ? "preparation" : "search",
  });
  lastProgress = performance.now();
}

function sendMetaheuristicProgress() {
  if (!engine || !activeId) return;
  const { trace, ...rawSnapshot } = engine.result;
  const dur = elapsed();
  const snapshot: RunSnapshot = {
    ...rawSnapshot,
    durationMs: dur,
    durations: {
      constructionMs,
      preparationMs,
      searchMs: dur,
      totalMs: constructionMs + preparationMs + dur,
    },
  };
  send({
    type: "progress",
    id: activeId,
    snapshot,
    steps: trace.slice(sentSteps),
    paused,
    stage: "search",
  });
  sentSteps = trace.length;
  lastProgress = performance.now();
}

function startMetaheuristicSearch() {
  if (!activeId || !activeInput) return;
  phase = "searching";
  sentSteps = 0;
  started = performance.now();
  pausedMs = 0;
  lastProgress = started;

  try {
    engine = new Experiment({
      ...activeInput,
      initialRoute: lsBestRoute.length ? lsBestRoute : undefined,
      durations: {
        constructionMs,
        preparationMs,
        searchMs: 0,
        totalMs: constructionMs + preparationMs,
      },
    });
    if (preparationMs > 0 || activeInput.config.improve !== "none") {
      engine.result.initialRoute = [...lsInitialRoute];
      engine.result.initialCost = lsInitialCost;
      engine.result.preparedInitialRoute = [...lsBestRoute];
      engine.result.preparedInitialCost = lsBestCost;
    }
    timer = setTimeout(tick, 0);
  } catch (err) {
    send({
      type: "error",
      id: activeId,
      message: err instanceof Error ? err.message : "Gagal menginisialisasi engine pencarian.",
    });
    cleanup();
  }
}

function stepTwoOptBatch(): boolean {
  if (!lsMatrix || lsDone) return true;
  const batchStart = performance.now();
  const maxMoves = 10000;

  while (!lsDone && performance.now() - batchStart < 12) {
    let bestMove: Move | undefined;
    let bestDelta = -EPSILON;

    for (const move of twoOptList) {
      lsEvaluations++;
      const delta = moveDelta(lsCurrentRoute, move, lsMatrix);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestMove = move;
      }
    }

    if (!bestMove) {
      lsDone = true;
      lsStopReason = "no-improvement";
      return true;
    }

    const candidate = applyMove(lsCurrentRoute, bestMove);
    const candidateCost = routeCost(candidate, lsMatrix);
    if (candidateCost >= lsCurrentCost - EPSILON) {
      lsDone = true;
      lsStopReason = "no-improvement";
      return true;
    }

    lsCurrentRoute = candidate;
    lsCurrentCost = candidateCost;
    lsBestRoute = [...candidate];
    lsBestCost = candidateCost;
    lsSteps++;

    if (lsSteps >= maxMoves) {
      lsDone = true;
      lsStopReason = "step-limit";
      return true;
    }
  }

  return lsDone;
}

function stepThreeOptBatch(): boolean {
  if (!lsMatrix || lsDone) return true;
  const batchStart = performance.now();
  const maxMoves = 10000;
  const totalTriples = threeOptList.length;

  while (!lsDone && performance.now() - batchStart < 12) {
    // Process a slice of triples
    while (threeOptTripleIdx < totalTriples) {
      const [i, j, k] = threeOptList[threeOptTripleIdx]!;
      threeOptTripleIdx++;

      for (let caseType = 1; caseType <= 7; caseType++) {
        lsEvaluations++;
        const delta = threeOptDelta(
          lsCurrentRoute,
          { i, j, k, caseType: caseType as ThreeOptCase },
          lsMatrix,
        );
        if (delta < threeOptBestDelta) {
          threeOptBestDelta = delta;
          threeOptBestMove = { i, j, k, caseType: caseType as ThreeOptCase };
        }
      }

      if (performance.now() - batchStart >= 12) {
        return false; // Yield to event loop
      }
    }

    // Finished one full pass over all triples
    if (!threeOptBestMove) {
      lsDone = true;
      lsStopReason = "no-improvement";
      return true;
    }

    const candidate = applyThreeOptMove(lsCurrentRoute, threeOptBestMove);
    const candidateCost = routeCost(candidate, lsMatrix);
    if (candidateCost >= lsCurrentCost - EPSILON) {
      lsDone = true;
      lsStopReason = "no-improvement";
      return true;
    }

    lsCurrentRoute = candidate;
    lsCurrentCost = candidateCost;
    lsBestRoute = [...candidate];
    lsBestCost = candidateCost;
    lsSteps++;

    if (lsSteps >= maxMoves) {
      lsDone = true;
      lsStopReason = "step-limit";
      return true;
    }

    // Reset for next pass
    threeOptTripleIdx = 0;
    threeOptBestMove = undefined;
    threeOptBestDelta = -EPSILON;
  }

  return lsDone;
}

function cleanup() {
  activeId = null;
  activeInput = null;
  phase = "idle";
  paused = false;
  engine = undefined;
  lsMatrix = null;
  if (timer) clearTimeout(timer);
  timer = undefined;
}

function tick() {
  if (!activeId || !activeInput) return;

  try {
    if (paused) return;

    // --- Case 1: Preparing (2-OPT / 3-OPT before metaheuristic) ---
    if (phase === "preparing") {
      const improveMethod = activeInput.config.improve;
      const isFinished = improveMethod === "3OPT" ? stepThreeOptBatch() : stepTwoOptBatch();

      if (performance.now() - lastProgress >= 100) {
        sendLocalSearchProgress();
      }

      if (isFinished) {
        preparationMs = elapsed();
        startMetaheuristicSearch();
        return;
      }

      timer = setTimeout(tick, 0);
      return;
    }

    // --- Case 2: Local Search category ---
    if (phase === "searching" && activeInput.config.category === "local-search") {
      const is3Opt = activeInput.config.algorithm === "3OPT";
      const isFinished = is3Opt ? stepThreeOptBatch() : stepTwoOptBatch();

      if (performance.now() - lastProgress >= 100) {
        sendLocalSearchProgress();
      }

      if (isFinished) {
        const searchMs = elapsed();
        const result: RunResult = {
          id: activeId,
          createdAt: activeInput.createdAt,
          category: "local-search",
          dataset: activeInput.dataset,
          config: activeInput.config,
          initialRoute: lsInitialRoute,
          initialCost: lsInitialCost,
          currentRoute: lsCurrentRoute,
          currentCost: lsCurrentCost,
          bestRoute: lsBestRoute,
          bestCost: lsBestCost,
          trace: [],
          iterations: lsSteps,
          evaluations: lsEvaluations,
          initialRouteSource:
            activeInput.initialRoute || activeInput.config.initialMethod === "random"
              ? "snapshot"
              : "computed",
          durationMs: searchMs,
          durations: {
            constructionMs,
            searchMs,
            totalMs: constructionMs + searchMs,
          },
          status: lsStopReason === "cancelled" ? "cancelled" : "completed",
          stopReason: lsStopReason,
        };
        send({ type: "completed", id: activeId, result });
        cleanup();
        return;
      }

      timer = setTimeout(tick, 0);
      return;
    }

    // --- Case 3: Metaheuristic (TS or SA) ---
    if (phase === "searching" && engine) {
      if (engine.done) {
        const searchMs = elapsed();
        engine.result.durationMs = searchMs;
        engine.result.initialRouteSource =
          activeInput?.initialRoute || activeInput?.config.initialMethod === "random"
            ? "snapshot"
            : "computed";
        engine.result.durations = {
          constructionMs,
          preparationMs,
          searchMs,
          totalMs: constructionMs + preparationMs + searchMs,
        };
        send({ type: "completed", id: activeId, result: engine.result });
        cleanup();
        return;
      }

      const batchStart = performance.now();
      do {
        engine.step();
      } while (!engine.done && performance.now() - batchStart < 12);

      if (performance.now() - lastProgress >= 100) {
        sendMetaheuristicProgress();
      }

      timer = setTimeout(tick, 0);
      return;
    }
  } catch (error) {
    if (activeId) {
      send({
        type: "error",
        id: activeId,
        message: error instanceof Error ? error.message : "Engine mengalami kesalahan.",
      });
    }
    cleanup();
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === "start") {
    if (timer) clearTimeout(timer);
    cleanup();

    activeId = message.id;
    activeInput = message.input;
    const { dataset, config, initialRoute } = message.input;
    const category = config.category ?? "metaheuristic";

    try {
      lsMatrix = distanceMatrix(dataset.nodes);

      // 1. Construction Experiment
      if (category === "construction") {
        const t0 = performance.now();
        const route = makeInitialRoute(dataset, {
          initialMethod: config.initialMethod,
          improve: "none",
          startId: config.startId,
        });
        const cMs = performance.now() - t0;
        const cost = routeCost(route, lsMatrix);

        const result: RunResult = {
          id: message.id,
          createdAt: message.input.createdAt,
          category: "construction",
          dataset,
          config,
          initialRoute: route,
          initialCost: cost,
          currentRoute: route,
          currentCost: cost,
          bestRoute: route,
          bestCost: cost,
          trace: [],
          iterations: 0,
          evaluations: 0,
          durationMs: cMs,
          durations: { constructionMs: cMs, totalMs: cMs },
          status: "completed",
          stopReason: "completed",
        };
        send({ type: "completed", id: message.id, result });
        cleanup();
        return;
      }

      // 2. Local Search Experiment
      if (category === "local-search") {
        const t0 = performance.now();
        const baseRoute = initialRoute
          ? [...initialRoute]
          : makeInitialRoute(dataset, {
              initialMethod: config.initialMethod,
              improve: "none",
              startId: config.startId,
            });
        constructionMs = performance.now() - t0;
        lsInitialRoute = [...baseRoute];
        lsInitialCost = routeCost(baseRoute, lsMatrix);
        lsCurrentRoute = [...baseRoute];
        lsCurrentCost = lsInitialCost;
        lsBestRoute = [...baseRoute];
        lsBestCost = lsInitialCost;
        lsSteps = 0;
        lsEvaluations = 0;
        lsDone = false;
        lsStopReason = "no-improvement";

        if (config.algorithm === "3OPT") {
          threeOptList = threeOptTriples(baseRoute.length);
          threeOptTripleIdx = 0;
          threeOptBestMove = undefined;
          threeOptBestDelta = -EPSILON;
          if (!threeOptList.length) {
            lsDone = true;
            lsStopReason = "empty-neighborhood";
          }
        } else {
          twoOptList = twoOptMoves(baseRoute.length);
          if (!twoOptList.length) {
            lsDone = true;
            lsStopReason = "empty-neighborhood";
          }
        }

        phase = "searching";
        started = performance.now();
        lastProgress = started;
        paused = false;
        pausedMs = 0;
        timer = setTimeout(tick, 0);
        return;
      }

      // 3. Metaheuristic Experiment
      const t0 = performance.now();
      const baseRoute = initialRoute
        ? [...initialRoute]
        : makeInitialRoute(dataset, {
            initialMethod: config.initialMethod,
            improve: "none",
            startId: config.startId,
          });
      constructionMs = performance.now() - t0;
      preparationMs = 0;

      lsInitialRoute = [...baseRoute];
      lsInitialCost = routeCost(baseRoute, lsMatrix);
      lsCurrentRoute = [...baseRoute];
      lsCurrentCost = lsInitialCost;
      lsBestRoute = [...baseRoute];
      lsBestCost = lsInitialCost;
      lsSteps = 0;
      lsEvaluations = 0;
      lsDone = false;

      const needsPreparation = config.improve === "2OPT" || config.improve === "3OPT";

      if (needsPreparation) {
        phase = "preparing";
        started = performance.now();
        lastProgress = started;
        paused = false;
        pausedMs = 0;

        if (config.improve === "3OPT") {
          threeOptList = threeOptTriples(baseRoute.length);
          threeOptTripleIdx = 0;
          threeOptBestMove = undefined;
          threeOptBestDelta = -EPSILON;
          if (!threeOptList.length) {
            lsDone = true;
            lsStopReason = "empty-neighborhood";
          }
        } else {
          twoOptList = twoOptMoves(baseRoute.length);
          if (!twoOptList.length) {
            lsDone = true;
            lsStopReason = "empty-neighborhood";
          }
        }

        timer = setTimeout(tick, 0);
      } else {
        startMetaheuristicSearch();
      }
    } catch (err) {
      send({
        type: "error",
        id: message.id,
        message: err instanceof Error ? err.message : "Input tidak valid.",
      });
      cleanup();
    }
    return;
  }

  if (!activeId || activeId !== message.id) return;

  if (message.type === "pause" && !paused) {
    paused = true;
    pausedAt = performance.now();
    if (
      phase === "preparing" ||
      (phase === "searching" && activeInput?.config.category === "local-search")
    ) {
      sendLocalSearchProgress();
    } else {
      sendMetaheuristicProgress();
    }
  }

  if (message.type === "resume" && paused) {
    pausedMs += performance.now() - pausedAt;
    paused = false;
    if (
      phase === "preparing" ||
      (phase === "searching" && activeInput?.config.category === "local-search")
    ) {
      sendLocalSearchProgress();
    } else {
      sendMetaheuristicProgress();
    }
    timer = setTimeout(tick, 0);
  }

  if (message.type === "cancel") {
    if (timer) clearTimeout(timer);

    if (phase === "preparing") {
      // Prompt requirement: If preparation is cancelled, do NOT run TS/SA on incomplete route.
      // Mark result as cancelled/partial and preserve best valid route so far.
      const dur = elapsed();
      const result: RunResult = {
        id: activeId,
        createdAt: activeInput!.createdAt,
        category: "metaheuristic",
        dataset: activeInput!.dataset,
        config: activeInput!.config,
        initialRoute: lsInitialRoute,
        initialCost: lsInitialCost,
        currentRoute: lsCurrentRoute,
        currentCost: lsCurrentCost,
        bestRoute: lsBestRoute,
        bestCost: lsBestCost,
        trace: [],
        iterations: 0,
        evaluations: 0,
        preparationSteps: lsSteps,
        preparationEvaluations: lsEvaluations,
        preparedInitialRoute: [...lsBestRoute],
        preparedInitialCost: lsBestCost,
        cancelledStage: "preparation",
        initialRouteSource:
          activeInput?.initialRoute || activeInput?.config.initialMethod === "random"
            ? "snapshot"
            : "computed",
        durationMs: dur,
        durations: {
          constructionMs,
          preparationMs: dur,
          totalMs: constructionMs + dur,
        },
        status: "cancelled",
        stopReason: "cancelled",
      };
      send({ type: "completed", id: activeId, result });
      cleanup();
      return;
    }

    if (phase === "searching" && activeInput?.config.category === "local-search") {
      lsDone = true;
      lsStopReason = "cancelled";
      const dur = elapsed();
      const result: RunResult = {
        id: activeId,
        createdAt: activeInput.createdAt,
        category: "local-search",
        dataset: activeInput.dataset,
        config: activeInput.config,
        initialRoute: lsInitialRoute,
        initialCost: lsInitialCost,
        currentRoute: lsCurrentRoute,
        currentCost: lsCurrentCost,
        bestRoute: lsBestRoute,
        bestCost: lsBestCost,
        trace: [],
        iterations: lsSteps,
        evaluations: lsEvaluations,
        initialRouteSource:
          activeInput?.initialRoute || activeInput?.config.initialMethod === "random"
            ? "snapshot"
            : "computed",
        cancelledStage: "search",
        durationMs: dur,
        durations: {
          constructionMs,
          searchMs: dur,
          totalMs: constructionMs + dur,
        },
        status: "cancelled",
        stopReason: "cancelled",
      };
      send({ type: "completed", id: activeId, result });
      cleanup();
      return;
    }

    if (phase === "searching" && engine) {
      engine.stop("cancelled");
      const searchMs = elapsed();
      engine.result.durationMs = searchMs;
      engine.result.cancelledStage = "search";
      engine.result.initialRouteSource =
        activeInput?.initialRoute || activeInput?.config.initialMethod === "random"
          ? "snapshot"
          : "computed";
      engine.result.durations = {
        constructionMs,
        preparationMs,
        searchMs,
        totalMs: constructionMs + preparationMs + searchMs,
      };
      send({ type: "completed", id: activeId, result: engine.result });
      cleanup();
      return;
    }
  }
});
