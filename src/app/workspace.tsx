import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from "react";
import { EXAMPLE, type Dataset, type TspNode } from "../domain/tsp/model";
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
export type Action =
  | { type: "restore"; session: SavedSession }
  | { type: "dataset"; dataset: Dataset }
  | { type: "add_node"; x: number; y: number }
  | { type: "move_node"; id: string; x: number; y: number }
  | { type: "remove_node"; id: string }
  | { type: "clear_nodes" }
  | { type: "random_nodes"; count: number }
  | { type: "set_nodes"; nodes: TspNode[]; name?: string }
  | { type: "load_example" }
  | { type: "config"; config: RunConfig }
  | { type: "start"; id: string }
  | { type: "worker"; message: WorkerResponse }
  | { type: "select"; id: string }
  | { type: "remove_run"; id: string }
  | { type: "clear_runs" }
  | { type: "error"; message: string };

function getNextNodeId(existingNodes: TspNode[]): string {
  const existing = new Set(existingNodes.map((n) => n.id.trim().toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const char = String.fromCharCode(65 + i);
    if (!existing.has(char)) return char;
  }
  let num = 1;
  while (existing.has(`N${num}`)) {
    num++;
  }
  return `N${num}`;
}

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

    case "dataset": {
      const startId = action.dataset.nodes.some((node) => node.id === state.config.startId)
        ? state.config.startId
        : (action.dataset.nodes[0]?.id ?? "A");
      return {
        ...state,
        dataset: action.dataset,
        config: { ...state.config, startId },
        active: null,
        selectedId: null,
        error: null,
      };
    }

    case "add_node": {
      const nextId = getNextNodeId(state.dataset.nodes);
      const newNodes = [...state.dataset.nodes, { id: nextId, x: action.x, y: action.y }];
      const newDataset: Dataset = {
        ...state.dataset,
        nodes: newNodes,
      };
      const startId = newNodes.some((node) => node.id === state.config.startId)
        ? state.config.startId
        : newNodes[0]!.id;
      return {
        ...state,
        dataset: newDataset,
        config: { ...state.config, startId },
        active: null,
        selectedId: null,
        error: null,
      };
    }

    case "move_node": {
      const newNodes = state.dataset.nodes.map((node) =>
        node.id === action.id ? { ...node, x: action.x, y: action.y } : node,
      );
      return {
        ...state,
        dataset: { ...state.dataset, nodes: newNodes },
        active: null,
        selectedId: null,
        error: null,
      };
    }

    case "remove_node": {
      const newNodes = state.dataset.nodes.filter((node) => node.id !== action.id);
      const startId = newNodes.some((node) => node.id === state.config.startId)
        ? state.config.startId
        : (newNodes[0]?.id ?? "");
      return {
        ...state,
        dataset: { ...state.dataset, nodes: newNodes },
        config: { ...state.config, startId },
        active: null,
        selectedId: null,
        error: null,
      };
    }

    case "clear_nodes": {
      return {
        ...state,
        dataset: { ...state.dataset, nodes: [] },
        config: { ...state.config, startId: "" },
        active: null,
        selectedId: null,
        error: null,
      };
    }

    case "random_nodes": {
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const count = Math.max(3, Math.min(action.count, 50));
      const generated: TspNode[] = [];
      const usedCoords = new Set<string>();
      for (let i = 0; i < count; i++) {
        let x = 0;
        let y = 0;
        let attempts = 0;
        do {
          x = Math.round((Math.random() * 20 - 10) * 10) / 10;
          y = Math.round((Math.random() * 16 - 8) * 10) / 10;
          attempts++;
        } while (usedCoords.has(`${x},${y}`) && attempts < 50);
        usedCoords.add(`${x},${y}`);
        const id = i < 26 ? letters[i]! : `N${i + 1}`;
        generated.push({ id, x, y });
      }
      return {
        ...state,
        dataset: {
          ...state.dataset,
          name: `Acak ${count} node`,
          nodes: generated,
        },
        config: { ...state.config, startId: generated[0]!.id },
        active: null,
        selectedId: null,
        error: null,
      };
    }

    case "set_nodes": {
      const startId = action.nodes.some((node) => node.id === state.config.startId)
        ? state.config.startId
        : (action.nodes[0]?.id ?? "");
      return {
        ...state,
        dataset: {
          ...state.dataset,
          name: action.name ?? state.dataset.name,
          nodes: action.nodes,
        },
        config: { ...state.config, startId },
        active: null,
        selectedId: null,
        error: null,
      };
    }

    case "load_example": {
      const exampleCopy = structuredClone(EXAMPLE);
      return {
        ...state,
        dataset: exampleCopy,
        config: { ...state.config, startId: exampleCopy.nodes[0]!.id },
        active: null,
        selectedId: null,
        error: null,
      };
    }

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

    case "remove_run": {
      const newRuns = state.runs.filter((r) => r.id !== action.id);
      const isSelectedRemoved = state.selectedId === action.id;
      const isActiveRemoved = state.active?.id === action.id;
      const nextSelected = isSelectedRemoved ? (newRuns[0]?.id ?? null) : state.selectedId;
      const nextActive = isActiveRemoved ? null : state.active;
      return {
        ...state,
        runs: newRuns,
        selectedId: nextSelected,
        active: nextActive,
      };
    }

    case "clear_runs": {
      return {
        ...state,
        runs: [],
        selectedId: null,
        active: null,
      };
    }

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
