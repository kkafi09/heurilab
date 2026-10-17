import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { MotionConfig } from "motion/react";
import { useWorkspace } from "./workspace";
import { Header } from "./Header";
import { InteractiveCanvas } from "../features/canvas/InteractiveCanvas";
import { ControlHub } from "../features/experiment/ControlHub";
import { ReportView } from "../features/report/ReportView";
import { HelpModal } from "../features/experiment/HelpModal";
import {
  AnimatedToastStack,
  useAnimatedToastStack,
} from "../components/motion/animated-toast-stack";
import { Button } from "../components/ui";
import { loadSession, saveSession } from "../services/storage";
import {
  makeInitialRoute,
  validateConfig,
  type RunConfig,
  type RunResult,
} from "../domain/algorithms/experiment";
import {
  validateDataset,
  type Dataset,
  type Route,
  type ValidationIssue,
} from "../domain/tsp/model";
import type { WorkerRequest, WorkerResponse } from "../services/protocol";

export function App() {
  const { state, dispatch } = useWorkspace();
  const { toasts, showToast, dismissToast } = useAnimatedToastStack({ limit: 3 });

  const [view, setView] = useState<"playground" | "report">("playground");
  const [ready, setReady] = useState(false);
  const [persist, setPersist] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [help, setHelp] = useState(false);

  const worker = useRef<Worker | null>(null);
  const runId = useRef<string | null>(null);

  const busy = state.phase !== "idle";
  const run = state.active ?? state.runs.find((item) => item.id === state.selectedId) ?? null;

  const { initialMethod, improve, startId } = state.config;

  // Calculate baseline initial route for current dataset
  // Avoid heavy 3-OPT calculation on the synchronous render path
  const initial = useMemo(() => {
    if (state.dataset.nodes.length < 3) {
      return state.dataset.nodes.map((_, i) => i);
    }
    try {
      const previewImprove = improve === "3OPT" ? "none" : improve;
      return makeInitialRoute(state.dataset, { initialMethod, improve: previewImprove, startId });
    } catch {
      return state.dataset.nodes.map((_, i) => i);
    }
  }, [state.dataset, initialMethod, improve, startId]);

  // Active routes for canvas rendering
  const routes = useMemo(() => {
    if (run) {
      return {
        current: run.currentRoute ?? initial,
        best: run.bestRoute ?? initial,
        candidate: undefined,
      };
    }
    return {
      current: initial,
      best: initial,
      candidate: undefined,
    };
  }, [run, initial]);

  // Load session from IndexedDB on startup
  useEffect(() => {
    let live = true;
    void loadSession()
      .then((session) => {
        if (live) {
          if (session) dispatch({ type: "restore", session });
          setReady(true);
        }
      })
      .catch((error) => {
        if (live) {
          setStorageError(error instanceof Error ? error.message : "Sesi gagal dimuat.");
          setPersist(false);
          setReady(true);
        }
      });
    return () => {
      live = false;
    };
  }, [dispatch]);

  // Persist session changes debounce 500ms
  useEffect(() => {
    if (!ready || !persist || validateConfig(state.config, state.dataset).length) return;
    let live = true;
    const timer = setTimeout(() => {
      void saveSession({
        version: 2,
        dataset: state.dataset,
        config: state.config,
        runs: state.runs,
      })
        .then(() => {
          if (live) setSaved(true);
        })
        .catch((error) => {
          if (live) {
            setStorageError(error instanceof Error ? error.message : "Penyimpanan gagal.");
            setPersist(false);
          }
        });
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [ready, persist, state.dataset, state.config, state.runs]);

  // Clean up worker on unmount
  useEffect(() => () => worker.current?.terminate(), []);

  function start(dataset = state.dataset, config = state.config, initialRoute?: Route) {
    if (busy || !ready || dataset.nodes.length < 3) return;
    try {
      const issues = validateDataset(dataset);
      const cfgErrors = validateConfig(config, dataset);
      if (issues.length || cfgErrors.length) {
        throw new Error([...issues.map((i: ValidationIssue) => i.message), ...cfgErrors].join(" "));
      }

      worker.current?.terminate();
      const current = new Worker(new URL("../workers/optimizer.ts", import.meta.url), {
        type: "module",
      });
      worker.current = current;
      const id = crypto.randomUUID();
      runId.current = id;
      dispatch({ type: "start", id });

      current.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.id !== runId.current) return;
        dispatch({ type: "worker", message });

        if (message.type === "completed") {
          setSaved(false);
          showToast({
            title: message.result.status === "cancelled" ? "Run dibatalkan" : "Eksperimen selesai",
            description: "Best-so-far dan hasil tersedia di riwayat serta halaman Report.",
            status: "success",
          });
          current.terminate();
          worker.current = null;
          runId.current = null;
        }

        if (message.type === "error") {
          current.terminate();
          worker.current = null;
          runId.current = null;
        }
      });

      current.addEventListener("error", () => {
        dispatch({
          type: "worker",
          message: {
            type: "error",
            id,
            message: "Worker gagal berjalan. Coba jalankan ulang eksperimen.",
          },
        });
        current.terminate();
        worker.current = null;
        runId.current = null;
      });

      const message: WorkerRequest = {
        type: "start",
        id,
        input: { id, createdAt: new Date().toISOString(), dataset, config, initialRoute },
      };
      // oxlint-disable-next-line unicorn/require-post-message-target-origin
      current.postMessage(message);
    } catch (error) {
      dispatch({
        type: "error",
        message: error instanceof Error ? error.message : "Eksperimen gagal dimulai.",
      });
    }
  }

  function control(type: "pause" | "resume" | "cancel") {
    if (runId.current) {
      worker.current?.postMessage({ type, id: runId.current } satisfies WorkerRequest);
    }
  }

  function applyDataset(dataset: Dataset) {
    setSaved(false);
    dispatch({ type: "dataset", dataset });
    showToast({
      title: "Dataset diterapkan",
      description: `${dataset.nodes.length} node siap dipakai di kanvas.`,
      status: "success",
    });
  }

  function repeat(previous: RunResult) {
    if (previous.category === "metaheuristic") {
      const config: RunConfig = {
        ...previous.config,
        algorithm: previous.config.algorithm === "TS" ? "SA" : "TS",
      };
      dispatch({ type: "dataset", dataset: previous.dataset });
      dispatch({ type: "config", config });
      start(previous.dataset, config, previous.initialRoute);
    } else if (previous.category === "local-search") {
      const config: RunConfig = {
        ...previous.config,
        algorithm: previous.config.algorithm === "2OPT" ? "3OPT" : "2OPT",
      };
      dispatch({ type: "dataset", dataset: previous.dataset });
      dispatch({ type: "config", config });
      start(previous.dataset, config);
    } else {
      start(previous.dataset, previous.config);
    }
  }

  function removeRun(id: string) {
    setSaved(false);
    dispatch({ type: "remove_run", id });
    showToast({
      title: "Riwayat dihapus",
      description: "Hasil run telah dibersihkan dari sesi.",
      status: "info",
    });
  }

  function clearRuns() {
    setSaved(false);
    dispatch({ type: "clear_runs" });
    showToast({
      title: "Semua riwayat dibersihkan",
      description: "Daftar riwayat eksperimen telah dikosongkan.",
      status: "info",
    });
  }

  const hasConfigErrors = validateConfig(state.config, state.dataset).length > 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <a className="skip-link" href="#workspace">
          Lewati ke workspace
        </a>

        {/* Header Ramping dengan Switcher Playground & Report */}
        <Header
          view={view}
          onViewChange={setView}
          runsCount={state.runs.length}
          ready={ready}
          saved={saved}
          storageError={storageError}
          hasConfigErrors={hasConfigErrors}
          onToggleHelp={() => setHelp((v) => !v)}
        />

        <main>
          {storageError && (
            <div className="notice storage-notice" role="alert">
              <AlertCircle size={18} />
              <div>
                <strong>Penyimpanan lokal membutuhkan perhatian.</strong>
                <p>{storageError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStorageError(null);
                    setPersist(true);
                  }}
                >
                  Simpan sesi saat ini
                </Button>
              </div>
            </div>
          )}

          {state.error && (
            <div className="error-banner" role="alert">
              {state.error}
            </div>
          )}

          {/* Modal Panduan Interaktif Modern */}
          <HelpModal isOpen={help} onClose={() => setHelp(false)} />

          {/* View: Playground (Grid 8:4) vs Dedicated Report */}
          {view === "playground" ? (
            <div className="workspace-8-4" id="workspace">
              {/* Kolom 8: Interactive Canvas Playground */}
              <div className="canvas-column">
                <InteractiveCanvas
                  dataset={run?.dataset ?? state.dataset}
                  initial={run?.initialRoute ?? initial}
                  current={routes.current}
                  best={routes.best}
                  candidate={routes.candidate}
                  startId={state.config.startId}
                  onAddNode={(x, y) => {
                    setSaved(false);
                    dispatch({ type: "add_node", x, y });
                  }}
                  onMoveNode={(id, x, y) => {
                    setSaved(false);
                    dispatch({ type: "move_node", id, x, y });
                  }}
                  onRemoveNode={(id) => {
                    setSaved(false);
                    dispatch({ type: "remove_node", id });
                  }}
                  onClearNodes={() => {
                    setSaved(false);
                    dispatch({ type: "clear_nodes" });
                  }}
                  onRandomNodes={(count) => {
                    setSaved(false);
                    dispatch({ type: "random_nodes", count });
                  }}
                  onLoadExample={() => {
                    setSaved(false);
                    dispatch({ type: "load_example" });
                  }}
                  onSetStartId={(id) => {
                    setSaved(false);
                    dispatch({ type: "config", config: { ...state.config, startId: id } });
                  }}
                  onUploadDataset={applyDataset}
                  busy={busy || !ready}
                  phase={state.phase}
                />
              </div>

              {/* Kolom 4: Control & Experiment Hub */}
              <div className="control-column">
                <ControlHub
                  dataset={state.dataset}
                  config={state.config}
                  phase={state.phase}
                  ready={ready}
                  run={run}
                  runs={state.runs}
                  onConfigChange={(config) => {
                    setSaved(false);
                    dispatch({ type: "config", config });
                  }}
                  onStart={() => start()}
                  onPause={() => control(state.phase === "paused" ? "resume" : "pause")}
                  onCancel={() => control("cancel")}
                  onRepeat={() => run && repeat(run)}
                  onSelectRun={(id) => dispatch({ type: "select", id })}
                  onRemoveRun={removeRun}
                  onOpenReport={() => setView("report")}
                />
              </div>
            </div>
          ) : (
            /* View: Dedicated Report */
            <ReportView
              runs={state.runs}
              activeRun={run}
              currentDataset={state.dataset}
              onSelectRun={(id) => dispatch({ type: "select", id })}
              onRemoveRun={removeRun}
              onClearRuns={clearRuns}
              onBackToPlayground={() => setView("playground")}
            />
          )}
        </main>
      </div>

      <AnimatedToastStack toasts={toasts} onDismiss={dismissToast} position="bottom-right" />
    </MotionConfig>
  );
}
