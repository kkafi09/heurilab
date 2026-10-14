import { useMemo, useState } from "react";
import { Download, ArrowUpRight, Activity, Route as RouteIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/motion/tabs";
import { Button, Empty, formatNumber, stopLabels } from "../../components/ui";
import { closedRoute, distanceMatrix, type Dataset, type Route } from "../../domain/tsp/model";
import { reconstruct, type RunResult, type TraceStep } from "../../domain/algorithms/experiment";
import { exportRun } from "../../services/export";
import { RouteView } from "./RouteView";
import { Comparison } from "../comparison/Comparison";

export function Results({
  run,
  dataset,
  initial,
  runs,
  phase,
  onSelect,
}: {
  run: RunResult | null;
  dataset: Dataset;
  initial: Route;
  runs: RunResult[];
  phase: string;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState("trace"),
    [selectedStep, setSelectedStep] = useState(-1);
  const displayedDataset = run?.dataset ?? dataset;
  const routes = useMemo(
    () =>
      run && selectedStep >= 0
        ? reconstruct(run, selectedStep)
        : {
            current: run?.currentRoute ?? initial,
            best: run?.bestRoute ?? initial,
            candidate: undefined,
          },
    [run, selectedStep, initial],
  );
  const step = selectedStep >= 0 ? run?.trace[selectedStep] : undefined;
  const improvement = run
    ? run.initialCost === 0
      ? 0
      : ((run.initialCost - run.bestCost) / run.initialCost) * 100
    : 0;
  return (
    <div className="results-column">
      <section className="panel visualization" aria-labelledby="map-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">03 · VISUALISASI RUTE</span>
            <h2 id="map-title">Lihat pencariannya bekerja</h2>
          </div>
          <span className={`status-pill ${phase === "running" ? "live" : ""}`} role="status">
            <i />
            {phase === "running"
              ? "Sedang mencari"
              : phase === "paused"
                ? "Dijeda"
                : run
                  ? "Run tersimpan"
                  : "Siap bereksperimen"}
          </span>
        </div>
        <div className="map-meta">
          <span>{displayedDataset.name}</span>
          <span>{displayedDataset.unit} · Euclidean</span>
        </div>
        <RouteView
          dataset={displayedDataset}
          initial={run?.initialRoute ?? initial}
          current={routes.current}
          best={routes.best}
          candidate={routes.candidate}
        />
        <div className="route-strip">
          <RouteIcon size={16} />
          <span className="small muted">
            {step ? `Best pada iterasi ${step.iteration}` : "Rute terbaik"}
          </span>
          <strong data-testid="best-route">
            {closedRoute(routes.best, displayedDataset).join(" → ")}
          </strong>
        </div>
      </section>
      <div className="metrics">
        <div className="metric primary">
          <span>
            Jarak terbaik <ArrowUpRight size={15} />
          </span>
          <strong data-testid="best-cost">{run ? formatNumber(run.bestCost) : "—"}</strong>
          <small>{displayedDataset.unit}</small>
        </div>
        <div className="metric">
          <span>Perbaikan dari awal</span>
          <strong>{run ? `${improvement.toFixed(2)}%` : "—"}</strong>
          <small>Awal: {run ? formatNumber(run.initialCost) : "belum dijalankan"}</small>
        </div>
        <div className="metric">
          <span>Iterasi / evaluasi</span>
          <strong>{run ? run.iterations.toLocaleString("id-ID") : "—"}</strong>
          <small>
            {run
              ? `${run.evaluations.toLocaleString("id-ID")} kandidat dievaluasi`
              : "Neighborhood 2-OPT"}
          </small>
        </div>
        <div className="metric">
          <span>Waktu komputasi</span>
          <strong>
            {run ? `${(run.durationMs / 1000).toFixed(2)}` : "—"}
            <em> s</em>
          </strong>
          <small>{run ? run.config.algorithm : "TS atau SA"} · tanpa waktu jeda</small>
        </div>
      </div>
      <section className="panel results-panel">
        <Tabs value={tab} onValueChange={setTab} variant="underline">
          <div className="results-top">
            <TabsList aria-label="Detail eksperimen">
              <TabsTrigger value="trace">
                <Activity size={15} />
                Trace iterasi
              </TabsTrigger>
              <TabsTrigger value="comparison">
                Perbandingan <span className="tab-count">{runs.length}</span>
              </TabsTrigger>
              <TabsTrigger value="matrix">Matriks jarak</TabsTrigger>
            </TabsList>
            <Button
              size="sm"
              variant="ghost"
              disabled={!run || phase !== "idle"}
              onClick={() => run && exportRun(run)}
            >
              <Download size={14} />
              Ekspor JSON
            </Button>
          </div>
          <TabsContent value="trace">
            {run ? (
              <>
                <div className="run-summary">
                  <strong>
                    {run.config.algorithm === "TS" ? "Tabu Search" : "Simulated Annealing"}
                  </strong>
                  <span>
                    {phase !== "idle"
                      ? phase === "paused"
                        ? "Dijeda"
                        : "Sedang berjalan"
                      : stopLabels[run.stopReason]}
                  </span>
                </div>
                <p className="small muted">
                  {run.config.initialMethod}
                  {run.config.improve ? " + 2-OPT" : ""} · start {run.config.startId} · budget{" "}
                  {run.config.maxIterations} ·{" "}
                  {run.config.algorithm === "SA"
                    ? `seed ${run.config.seed}, suhu ${run.config.initialTemperature}, cooling ${run.config.coolingRate}, ${run.config.iterationsPerTemperature} iterasi/suhu, minimum ${run.config.minimumTemperature}`
                    : `tenure ${run.config.tenure}, aspiration jika mengalahkan best`}
                  .
                </p>
                <CostChart run={run} />
                <TraceTable run={run} selected={selectedStep} onSelect={setSelectedStep} />
                {step && <TraceDetails step={step} dataset={run.dataset} />}
              </>
            ) : (
              <Empty title="Setiap langkah punya alasan">
                Jalankan eksperimen untuk menelusuri kandidat, keputusan algoritma, dan perubahan
                biaya rute.
              </Empty>
            )}
          </TabsContent>
          <TabsContent value="comparison">
            <Comparison
              runs={runs}
              disabled={phase !== "idle"}
              onSelect={(id) => {
                onSelect(id);
                setSelectedStep(-1);
                setTab("trace");
              }}
            />
          </TabsContent>
          <TabsContent value="matrix">
            <Matrix dataset={displayedDataset} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
function CostChart({ run }: { run: RunResult }) {
  if (!run.trace.length) return null;
  const sampled = run.trace.filter(
    (_, index) =>
      index % Math.max(1, Math.ceil(run.trace.length / 180)) === 0 ||
      index === run.trace.length - 1,
  );
  const values = [run.initialCost, ...sampled.flatMap((step) => [step.currentCost, step.bestCost])],
    min = Math.min(...values),
    max = Math.max(...values),
    span = Math.max(max - min, 0.001);
  const line = (key: "currentCost" | "bestCost") =>
    [{ iteration: 0, [key]: run.initialCost }, ...sampled]
      .map(
        (step, index) =>
          `${index ? "L" : "M"}${30 + (step.iteration / run.config.maxIterations) * 640},${94 - (((step[key] as number) - min) / span) * 68}`,
      )
      .join(" ");
  return (
    <div className="cost-chart">
      <div className="small muted">
        Konvergensi · current <span className="chart-blue">—</span> / best{" "}
        <span className="chart-green">—</span>
      </div>
      <svg viewBox="0 0 700 120" role="img" aria-label="Grafik biaya current dan best per iterasi">
        <path d="M30 94H670" stroke="#dce4df" />
        <path d={line("currentCost")} fill="none" stroke="#6996b6" strokeWidth="1.5" />
        <path d={line("bestCost")} fill="none" stroke="#147469" strokeWidth="2.5" />
        <text x="30" y="114">
          0
        </text>
        <text x="670" y="114" textAnchor="end">
          {run.config.maxIterations} iterasi
        </text>
        <text x="3" y="23">
          {max.toFixed(1)}
        </text>
      </svg>
    </div>
  );
}
function TraceTable({
  run,
  selected,
  onSelect,
}: {
  run: RunResult;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const [page, setPage] = useState(0),
    pageSize = 20,
    totalPages = Math.max(1, Math.ceil(run.trace.length / pageSize));
  if (!run.trace.length)
    return (
      <p className="notice">
        Run selesai tanpa move: {stopLabels[run.stopReason]}. Rute awal tetap menjadi best-so-far.
      </p>
    );
  return (
    <>
      <div className="trace-toolbar">
        <span className="small muted">Pilih iterasi untuk melihat rutenya.</span>
        <Button variant="ghost" size="sm" disabled={selected < 0} onClick={() => onSelect(-1)}>
          Tampilkan hasil akhir
        </Button>
      </div>
      <div className="table-scroll">
        <table className="trace-table">
          <thead>
            <tr>
              <th>Iterasi</th>
              <th>Move</th>
              <th>Kandidat</th>
              <th>Current</th>
              <th>Best</th>
              <th>Keputusan</th>
            </tr>
          </thead>
          <tbody>
            {run.trace.slice(page * pageSize, (page + 1) * pageSize).map((step, index) => (
              <tr
                key={step.iteration}
                className={selected === page * pageSize + index ? "selected-row" : ""}
              >
                <td>
                  <button
                    type="button"
                    className="step-button"
                    aria-label={`Lihat iterasi ${step.iteration}`}
                    aria-pressed={selected === page * pageSize + index}
                    onClick={() => onSelect(page * pageSize + index)}
                  >
                    {String(step.iteration).padStart(3, "0")} ↗
                  </button>
                </td>
                <td className="mono">
                  2-OPT ({step.move.i},{step.move.j})
                </td>
                <td>{formatNumber(step.candidateCost)}</td>
                <td>{formatNumber(step.currentCost)}</td>
                <td className="best-cell">{formatNumber(step.bestCost)}</td>
                <td>
                  <span className={`decision ${step.accepted ? "accepted" : "rejected"}`}>
                    {step.aspiration ? "Aspiration" : step.accepted ? "Diterima" : "Ditolak"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>
          {run.trace.length.toLocaleString("id-ID")} langkah · halaman {page + 1}/{totalPages}
        </span>
        <div>
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((value) => value - 1)}
          >
            Sebelumnya
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </>
  );
}
function TraceDetails({ step, dataset }: { step: TraceStep; dataset: Dataset }) {
  const edgeLabel = (key: string) =>
    key
      .split(":")
      .map((index) => dataset.nodes[Number(index)]!.id)
      .join("–");
  return (
    <div className="trace-detail" aria-live="polite">
      <strong>
        Iterasi {step.iteration} · Δ {formatNumber(step.delta)}
      </strong>
      <p>{step.reason}</p>
      {step.temperature !== undefined ? (
        <p className="mono small">
          T = {formatNumber(step.temperature)} · peluang = {step.probability?.toFixed(6)} · draw ={" "}
          {step.draw?.toFixed(6) ?? "tidak diperlukan"}
        </p>
      ) : (
        <>
          <p className="small">
            Kandidat tabu: {step.tabu ? "ya" : "tidak"} · aspiration:{" "}
            {step.aspiration ? "ya" : "tidak"}
          </p>
          <p className="small mono">
            Tabu list:{" "}
            {step.tabuEdges
              ?.map(([edge, expiry]) => `${edgeLabel(edge)} ≤ iterasi ${expiry}`)
              .join("; ") || "kosong"}
          </p>
        </>
      )}
    </div>
  );
}
function Matrix({ dataset }: { dataset: Dataset }) {
  const matrix = distanceMatrix(dataset.nodes);
  return (
    <>
      <p className="small muted">
        Jarak Euclidean dalam {dataset.unit}. Diagonal nol; pembulatan hanya untuk tampilan.
      </p>
      <div className="table-scroll matrix-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Node</th>
              {dataset.nodes.map((node) => (
                <th scope="col" key={node.id}>
                  {node.id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, index) => (
              <tr key={index}>
                <th scope="row">{dataset.nodes[index]!.id}</th>
                {row.map((cost, col) => (
                  <td className={index === col ? "diagonal" : ""} key={col}>
                    {formatNumber(cost)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
