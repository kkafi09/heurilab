import { Experiment } from "../domain/algorithms/experiment";
import type { WorkerRequest, WorkerResponse } from "../services/protocol";

let engine: Experiment | undefined,
  paused = false,
  timer: ReturnType<typeof setTimeout> | undefined;
let started = 0,
  pausedAt = 0,
  pausedMs = 0,
  lastProgress = 0,
  sentSteps = 0;
function send(message: WorkerResponse) {
  postMessage(message);
}
function elapsed() {
  return performance.now() - started - pausedMs - (paused ? performance.now() - pausedAt : 0);
}
function progress() {
  if (!engine) return;
  const { trace, ...snapshot } = engine.result;
  snapshot.durationMs = elapsed();
  send({ type: "progress", id: snapshot.id, snapshot, steps: trace.slice(sentSteps), paused });
  sentSteps = trace.length;
  lastProgress = performance.now();
}
function tick() {
  if (!engine) return;
  try {
    if (engine.done) {
      engine.result.durationMs = elapsed();
      send({ type: "completed", id: engine.result.id, result: engine.result });
      engine = undefined;
      return;
    }
    if (paused) return;
    const batchStart = performance.now();
    do {
      engine.step();
    } while (!engine.done && performance.now() - batchStart < 12);
    if (performance.now() - lastProgress >= 100) progress();
    timer = setTimeout(tick, 0);
  } catch (error) {
    if (engine)
      send({
        type: "error",
        id: engine.result.id,
        message: error instanceof Error ? error.message : "Engine mengalami kesalahan.",
      });
    engine = undefined;
  }
}
self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === "start") {
    if (timer) clearTimeout(timer);
    try {
      engine = new Experiment(message.input);
      paused = false;
      pausedMs = 0;
      sentSteps = 0;
      started = performance.now();
      lastProgress = started;
      timer = setTimeout(tick, 0);
    } catch (error) {
      send({
        type: "error",
        id: message.id,
        message: error instanceof Error ? error.message : "Input tidak valid.",
      });
    }
    return;
  }
  if (!engine || engine.result.id !== message.id) return;
  if (message.type === "pause" && !paused) {
    paused = true;
    pausedAt = performance.now();
    progress();
  }
  if (message.type === "resume" && paused) {
    pausedMs += performance.now() - pausedAt;
    paused = false;
    progress();
    timer = setTimeout(tick, 0);
  }
  if (message.type === "cancel") {
    engine.stop("cancelled");
    if (timer) clearTimeout(timer);
    tick();
  }
});
