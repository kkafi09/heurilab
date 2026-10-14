import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, FlaskConical, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { MotionConfig } from "motion/react";
import { useWorkspace } from "./workspace";
import { DatasetPanel } from "../features/dataset/DatasetPanel";
import { ConfigPanel } from "../features/experiment/ConfigPanel";
import { Results } from "../features/experiment/Results";
import { BouncyAccordion } from "../components/motion/bouncy-accordion";
import {
  AnimatedToastStack,
  useAnimatedToastStack,
} from "../components/motion/animated-toast-stack";
import { Button } from "../components/ui";
import { loadSession, saveSession } from "../services/storage";
import {
  makeInitialRoute,
  defaultConfig,
  validateConfig,
  type RunConfig,
  type RunResult,
} from "../domain/algorithms/experiment";
import type { Dataset, Route } from "../domain/tsp/model";
import type { WorkerRequest, WorkerResponse } from "../services/protocol";

export function App() {
  const { state, dispatch } = useWorkspace();
  const { toasts, showToast, dismissToast } = useAnimatedToastStack({ limit: 3 });
  const [ready, setReady] = useState(false),
    [persist, setPersist] = useState(true),
    [storageError, setStorageError] = useState<string | null>(null),
    [saved, setSaved] = useState(false),
    [help, setHelp] = useState(false);
  const worker = useRef<Worker | null>(null),
    runId = useRef<string | null>(null);
  const busy = state.phase !== "idle",
    run = state.active ?? state.runs.find((item) => item.id === state.selectedId) ?? null;
  const { initialMethod, improve, startId } = state.config;
  const initial = useMemo(() => {
    try {
      return makeInitialRoute(state.dataset, { ...defaultConfig, initialMethod, improve, startId });
    } catch {
      return state.dataset.nodes.map((_, i) => i);
    }
  }, [state.dataset, initialMethod, improve, startId]);
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
  useEffect(() => {
    if (!ready || !persist || validateConfig(state.config, state.dataset).length) return;
    let live = true;
    const timer = setTimeout(() => {
      void saveSession({
        version: 1,
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
  useEffect(() => () => worker.current?.terminate(), []);
  function start(dataset = state.dataset, config = state.config, initialRoute?: Route) {
    if (busy || !ready) return;
    try {
      makeInitialRoute(dataset, config);
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
            description: "Best-so-far dan trace tersedia di riwayat.",
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
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Dedicated Worker API, not Window.postMessage.
      current.postMessage(message);
    } catch (error) {
      dispatch({
        type: "error",
        message: error instanceof Error ? error.message : "Eksperimen gagal dimulai.",
      });
    }
  }
  function control(type: "pause" | "resume" | "cancel") {
    if (runId.current)
      worker.current?.postMessage({ type, id: runId.current } satisfies WorkerRequest);
  }
  function applyDataset(dataset: Dataset) {
    setSaved(false);
    dispatch({ type: "dataset", dataset });
    showToast({
      title: "Dataset diterapkan",
      description: `${dataset.nodes.length} node siap dipakai semua metode.`,
      status: "success",
    });
  }
  function repeat(previous: RunResult) {
    const config: RunConfig = {
      ...previous.config,
      algorithm: previous.config.algorithm === "TS" ? "SA" : "TS",
    };
    dispatch({ type: "dataset", dataset: previous.dataset });
    dispatch({ type: "config", config });
    start(previous.dataset, config, previous.initialRoute);
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <a className="skip-link" href="#workspace">
          Lewati ke workspace
        </a>
        <header className="site-header">
          <a href="/" className="brand" aria-label="HeuriLab beranda">
            <span className="brand-mark">
              <FlaskConical size={23} />
            </span>
            <span>
              Heuri<span className="brand-accent">Lab</span>
            </span>
            <span className="version-tag">LAB / 01</span>
          </a>
          <div className="header-actions">
            <span className="storage-status">
              {!ready ? (
                "Memuat sesi…"
              ) : storageError ? (
                "Mode memori"
              ) : validateConfig(state.config, state.dataset).length ? (
                "Parameter belum valid"
              ) : saved ? (
                <>
                  <CheckCircle2 size={13} />
                  Tersimpan lokal
                </>
              ) : (
                "Menyimpan sesi…"
              )}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setHelp((value) => !value)}>
              <BookOpen size={15} />
              Panduan
            </Button>
          </div>
        </header>
        <main>
          <div className="intro">
            <div>
              <span className="eyebrow">
                <i /> LABORATORIUM OPTIMASI METAHEURISTIK
              </span>
              <h1>
                Rute lebih pendek.
                <br />
                <span>Pemahaman lebih dalam.</span>
              </h1>
              <p>
                Eksplorasi Traveling Salesman Problem. Jalankan algoritma,
                <br className="desktop-break" /> telusuri setiap keputusan, dan bandingkan hasilnya.
              </p>
            </div>
            <div className="intro-aside">
              <span className="tiny-route">
                A <i /> B <i /> C <i /> A <ArrowUpRight size={18} />
              </span>
              <p>Satu dataset. Banyak kemungkinan.</p>
              <span className="example-badge">Contoh sintetis · pembelajaran</span>
            </div>
          </div>
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
          {help && (
            <section className="panel help-panel" aria-label="Panduan penggunaan">
              <h2>Mulai dari rasa ingin tahu</h2>
              <BouncyAccordion
                defaultValue="workflow"
                items={[
                  {
                    id: "workflow",
                    title: "Bagaimana menjalankan eksperimen?",
                    description:
                      "Gunakan contoh enam node atau masukkan ID, X, Y lalu Terapkan. Pilih solusi awal dan metode, atur parameter, lalu Jalankan eksperimen. Pilih iterasi pada Trace untuk melihat kandidat. Jalankan metode lain untuk mempertahankan dataset dan initial route yang sama.",
                  },
                  {
                    id: "methods",
                    title: "Mengapa current bisa lebih buruk dari best?",
                    description:
                      "TS memilih kandidat eligible terbaik meskipun lebih buruk. SA dapat menerima kandidat lebih buruk melalui probabilitas exp(−Δ/T). Best-so-far menyimpan rute terbaik sepanjang pencarian. Heuristik tidak menjamin optimum.",
                  },
                  {
                    id: "files",
                    title: "Impor, simpan, dan ekspor",
                    description:
                      "Gunakan Excel .xlsx dengan header id, x, y atau petakan kolom sendiri. Preview tidak mengubah data aktif sebelum diterapkan. Browser menyimpan dataset, parameter valid, dan 10 run terakhir. Ekspor JSON memuat seluruh run dan trace; CSV merangkum perbandingan. Riwayat mengikuti browser dan origin yang digunakan.",
                  },
                  {
                    id: "limits",
                    title: "Batas MVP",
                    description:
                      "3–100 node, jarak Euclidean planar, maksimal 10.000 iterasi. Dataset contoh adalah sintetis. 3-OPT, matriks jarak resmi, desktop Tauri, dan hosting publik tersedia pada pengembangan berikutnya. Seed SA mengulang keputusan; durasi komputasi dapat berbeda. Refresh menghentikan run yang belum selesai.",
                  },
                ]}
              />
            </section>
          )}
          <div className="workspace" id="workspace">
            <aside className="input-column">
              <DatasetPanel
                key={state.dataset.id}
                dataset={state.dataset}
                busy={busy || !ready}
                onApply={applyDataset}
              />
              <ConfigPanel
                dataset={state.dataset}
                config={state.config}
                phase={state.phase}
                ready={ready}
                onChange={(config) => {
                  setSaved(false);
                  dispatch({ type: "config", config });
                }}
                onStart={() => start()}
                onPause={() => control(state.phase === "paused" ? "resume" : "pause")}
                onCancel={() => control("cancel")}
                onRepeat={() => run && repeat(run)}
                run={run}
              />
              <div className="lab-note">
                <span>CATATAN LAB</span>
                <p>
                  Semua metode memakai jarak yang sama. Visual membantu memahami proses; angka
                  dihitung dengan presisi penuh.
                </p>
              </div>
            </aside>
            <Results
              key={run?.id ?? `dataset-${state.dataset.id}`}
              run={run}
              dataset={state.dataset}
              initial={initial}
              runs={state.runs}
              phase={state.phase}
              onSelect={(id) => dispatch({ type: "select", id })}
            />
          </div>
        </main>
        <footer>
          <span>
            HeuriLab <i>—</i> dari teori ke eksperimen.
          </span>
          <span>Web MVP · Euclidean TSP · v0.1</span>
        </footer>
      </div>
      <AnimatedToastStack toasts={toasts} onDismiss={dismissToast} position="bottom-right" />
    </MotionConfig>
  );
}
