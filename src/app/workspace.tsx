import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from "react";
import { EXAMPLE, type Dataset } from "../domain/tsp/model";
import { defaultConfig, type RunConfig, type RunResult } from "../domain/algorithms/experiment";
import type { SavedSession } from "../services/storage";
import type { WorkerResponse } from "../services/protocol";
export interface Workspace {
  dataset: Dataset;
  config: RunConfig;
  runs: RunResult[];
  active: RunResult | null;
  selectedId: string | null;
  phase: "idle" | "running" | "paused";
  runId: string | null;
  error: string | null;
}
type Action =
  | { type: "restore"; session: SavedSession }
  | { type: "dataset"; dataset: Dataset }
  | { type: "config"; config: RunConfig }
  | { type: "start"; id: string }
  | { type: "worker"; message: WorkerResponse }
  | { type: "select"; id: string }
  | { type: "error"; message: string };
const initial: Workspace = {
  dataset: structuredClone(EXAMPLE),
  config: { ...defaultConfig },
  runs: [],
  active: null,
  selectedId: null,
  phase: "idle",
  runId: null,
  error: null,
};
export function workspaceReducer(state: Workspace, action: Action): Workspace {
  switch (action.type) {
    case "restore":
      return { ...state, ...action.session, selectedId: action.session.runs[0]?.id ?? null };
    case "dataset":
      return {
        ...state,
        dataset: action.dataset,
        config: {
          ...state.config,
          startId: action.dataset.nodes.some((node) => node.id === state.config.startId)
            ? state.config.startId
            : action.dataset.nodes[0]!.id,
        },
        active: null,
        selectedId: null,
        error: null,
      };
    case "config":
      return { ...state, config: action.config, error: null };
    case "start":
      return {
        ...state,
        runId: action.id,
        phase: "running",
        active: null,
        selectedId: null,
        error: null,
      };
    case "select":
      return { ...state, selectedId: action.id, active: null };
    case "error":
      return { ...state, error: action.message };
    case "worker": {
      const message = action.message;
      if (message.id !== state.runId) return state;
      if (message.type === "error")
        return { ...state, phase: "idle", runId: null, error: message.message };
      if (message.type === "progress")
        return {
          ...state,
          phase: message.paused ? "paused" : "running",
          active: {
            ...message.snapshot,
            trace: [...(state.active?.trace ?? []), ...message.steps],
          },
        };
      return {
        ...state,
        phase: "idle",
        runId: null,
        active: message.result,
        selectedId: message.id,
        runs: [message.result, ...state.runs].slice(0, 10),
      };
    }
  }
}
const Context = createContext<{ state: Workspace; dispatch: Dispatch<Action> } | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initial);
  return <Context.Provider value={{ state, dispatch }}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Workspace provider tidak tersedia.");
  return context;
}
