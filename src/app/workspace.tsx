import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from "react";
import { EXAMPLE, type Dataset, type TspNode } from "../domain/tsp/model";
import { defaultConfig, type RunConfig, type RunResult } from "../domain/algorithms/experiment";
import type { SavedSession } from "../services/storage";
import type { WorkerResponse } from "../services/protocol";
import { getNextAvailableNodeId } from "../domain/tsp/manualInput";
import {
  generateRandomDataset,
  validateGeneratorConfig,
  rotateTourToStart,
  type GeneratorConfig,
} from "../domain/tsp/randomGenerator";
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
  | {
      type: "add_nodes";
      nodes: TspNode[];
      sourceDataset?: Dataset;
      isHistoricalSnapshot?: boolean;
      snapshotStartId?: string;
    }
  | { type: "move_node"; id: string; x: number; y: number }
  | { type: "remove_node"; id: string }
  | { type: "clear_nodes" }
  | { type: "random_nodes"; count: number }
  | { type: "generate_dataset"; config: GeneratorConfig }
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
  return getNextAvailableNodeId(existing);
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
      const initialMethod =
        state.config.initialMethod === "random" && !action.dataset.randomTourNodeIds
          ? "NN"
          : state.config.initialMethod;
      return {
        ...state,
        dataset: action.dataset,
        config: { ...state.config, startId, initialMethod },
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
        generator: state.dataset.generator
          ? { ...state.dataset.generator, isEdited: true }
          : undefined,
        randomTourNodeIds: state.dataset.randomTourNodeIds
          ? [...state.dataset.randomTourNodeIds, nextId]
          : undefined,
        provenance:
          state.dataset.generator && !state.dataset.generator.isEdited
            ? `${state.dataset.provenance} (Telah diedit dari hasil generator: penambahan node).`
            : state.dataset.provenance,
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

    case "add_nodes": {
      if (action.nodes.length === 0) return state;
      const baseDataset =
        action.isHistoricalSnapshot && action.sourceDataset ? action.sourceDataset : state.dataset;

      const newNodes = [...baseDataset.nodes, ...action.nodes];
      const newIds = action.nodes.map((n) => n.id);
      let newDataset: Dataset;

      if (action.isHistoricalSnapshot && action.sourceDataset) {
        newDataset = {
          id: crypto.randomUUID(),
          name: `${action.sourceDataset.name} (Cabang)`,
          nodes: newNodes,
          unit: action.sourceDataset.unit,
          provenance: `Bercabang dari ${action.sourceDataset.name} dengan penambahan ${action.nodes.length} koordinat manual.`,
          randomTourNodeIds: baseDataset.randomTourNodeIds
            ? [...baseDataset.randomTourNodeIds, ...newIds]
            : undefined,
        };
      } else {
        newDataset = {
          ...state.dataset,
          nodes: newNodes,
          generator: state.dataset.generator
            ? { ...state.dataset.generator, isEdited: true }
            : undefined,
          randomTourNodeIds: state.dataset.randomTourNodeIds
            ? [...state.dataset.randomTourNodeIds, ...newIds]
            : undefined,
          provenance:
            state.dataset.generator && !state.dataset.generator.isEdited
              ? `${state.dataset.provenance} (Telah diedit dari hasil generator: penambahan node manual).`
              : state.dataset.provenance || "Koordinat planar dengan penambahan manual.",
        };
      }

      let startId = state.config.startId;
      if (
        action.isHistoricalSnapshot &&
        action.snapshotStartId &&
        newNodes.some((n) => n.id === action.snapshotStartId)
      ) {
        startId = action.snapshotStartId;
      } else if (!newNodes.some((node) => node.id === startId)) {
        startId = newNodes[0]?.id ?? "";
      }

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
      const newDataset: Dataset = {
        ...state.dataset,
        nodes: newNodes,
        generator: state.dataset.generator
          ? { ...state.dataset.generator, isEdited: true }
          : undefined,
        provenance:
          state.dataset.generator && !state.dataset.generator.isEdited
            ? `${state.dataset.provenance} (Telah diedit dari hasil generator: posisi node digeser).`
            : state.dataset.provenance,
      };
      return {
        ...state,
        dataset: newDataset,
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
      const newDataset: Dataset = {
        ...state.dataset,
        nodes: newNodes,
        generator: state.dataset.generator
          ? { ...state.dataset.generator, isEdited: true }
          : undefined,
        randomTourNodeIds: state.dataset.randomTourNodeIds
          ? state.dataset.randomTourNodeIds.filter((id) => id !== action.id)
          : undefined,
        provenance:
          state.dataset.generator && !state.dataset.generator.isEdited
            ? `${state.dataset.provenance} (Telah diedit dari hasil generator: penghapusan node).`
            : state.dataset.provenance,
      };
      return {
        ...state,
        dataset: newDataset,
        config: { ...state.config, startId },
        active: null,
        selectedId: null,
        error: null,
      };
    }

    case "clear_nodes": {
      return {
        ...state,
        dataset: {
          ...state.dataset,
          nodes: [],
          generator: undefined,
          randomTourNodeIds: undefined,
        },
        config: {
          ...state.config,
          startId: "",
          initialMethod:
            state.config.initialMethod === "random" ? "NN" : state.config.initialMethod,
        },
        active: null,
        selectedId: null,
        error: null,
      };
    }

    case "generate_dataset": {
      const errors = validateGeneratorConfig(action.config);
      if (errors.length > 0) {
        return { ...state, error: errors.join(" ") };
      }
      try {
        const result = generateRandomDataset(action.config);
        const startId = result.dataset.nodes[0]!.id;
        return {
          ...state,
          dataset: result.dataset,
          config: { ...state.config, startId, initialMethod: "random" },
          active: null,
          selectedId: null,
          error: null,
        };
      } catch (err) {
        return {
          ...state,
          error: err instanceof Error ? err.message : "Gagal membangkitkan dataset acak.",
        };
      }
    }

    case "random_nodes": {
      const count = Math.max(3, Math.min(action.count, 100));
      try {
        const result = generateRandomDataset({ nodeCount: count, distribution: "uniform" });
        const startId = result.dataset.nodes[0]!.id;
        return {
          ...state,
          dataset: result.dataset,
          config: { ...state.config, startId, initialMethod: "random" },
          active: null,
          selectedId: null,
          error: null,
        };
      } catch (err) {
        return {
          ...state,
          error: err instanceof Error ? err.message : "Gagal membangkitkan dataset acak.",
        };
      }
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
        config: {
          ...state.config,
          startId: exampleCopy.nodes[0]!.id,
          initialMethod:
            state.config.initialMethod === "random" ? "NN" : state.config.initialMethod,
        },
        active: null,
        selectedId: null,
        error: null,
      };
    }

    case "config": {
      let dataset = state.dataset;
      if (
        action.config.startId !== state.config.startId &&
        state.dataset.randomTourNodeIds &&
        state.dataset.nodes.some((n) => n.id === action.config.startId)
      ) {
        const rotated = rotateTourToStart(state.dataset.randomTourNodeIds, action.config.startId);
        dataset = { ...state.dataset, randomTourNodeIds: rotated };
      }
      return { ...state, dataset, config: action.config, error: null };
    }

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
