import type { RunInput, RunResult, TraceStep } from "../domain/algorithms/experiment";
export type RunSnapshot = Omit<RunResult, "trace">;
export type WorkerRequest =
  | { type: "start"; id: string; input: RunInput }
  | { type: "pause" | "resume" | "cancel"; id: string };
export type WorkerResponse =
  | {
      type: "progress";
      id: string;
      snapshot: RunSnapshot;
      steps: TraceStep[];
      paused: boolean;
      stage?: "preparation" | "search";
    }
  | { type: "completed"; id: string; result: RunResult }
  | { type: "error"; id: string; message: string };
