import { useState } from "react";
import {
  Download,
  ArrowLeft,
  Activity,
  TableProperties,
  TrendingDown,
  Clock,
  Layers,
  Eye,
  Trash2,
  CheckCircle2,
  GitCompare,
} from "lucide-react";
import { Button, Empty, formatNumber, stopLabels } from "../../components/ui";
import { Select } from "../../components/ui/select";
import { distanceMatrix, datasetKey, type Dataset } from "../../domain/tsp/model";
import {
  type RunResult,
  type TraceStep,
  type RunCategory,
} from "../../domain/algorithms/experiment";
import { exportComparison, exportRun } from "../../services/export";

function getCategoryBadge(category?: RunCategory) {
  switch (category) {
    case "construction":
      return {
        label: "Konstruksi",
        badgeClass: "bg-sky-100 text-sky-800 border border-sky-200",
      };
    case "local-search":
      return {
        label: "Local Search",
        badgeClass: "bg-indigo-100 text-indigo-800 border border-indigo-200",
      };
    case "metaheuristic":
    default:
      return {
        label: "Metaheuristik",
        badgeClass: "bg-teal-100 text-teal-800 border border-teal-200",
      };
  }
}

function getMethodTitle(run: RunResult) {
  if (run.category === "construction") {
    if (run.config.initialMethod === "NN") return "Nearest Neighbor (NN)";
    if (run.config.initialMethod === "NI") return "Nearest Insertion (NI)";
    return "Nearest Farthest Insertion (NFI)";
  }
  if (run.category === "local-search") {
    return run.config.algorithm === "3OPT" || run.config.improve === "3OPT"
      ? "3-OPT Descent"
      : "2-OPT Descent";
  }
  return run.config.algorithm === "TS" ? "Tabu Search (TS)" : "Simulated Annealing (SA)";
}

function evaluateCondition(
  target: RunResult,
  reference: RunResult | null,
): { label: string; className: "same" | "different" | "neutral" } {
  if (!reference || target.id === reference.id) {
    return { label: "Acuan", className: "same" };
  }
  const datasetMatches = datasetKey(target.dataset) === datasetKey(reference.dataset);
  if (!datasetMatches) {
    return { label: "Dataset Berbeda", className: "different" };
  }
  if (target.category === "metaheuristic" && reference.category === "metaheuristic") {
    const routeMatches = target.initialRoute.join(",") === reference.initialRoute.join(",");
    const iterMatches = target.config.maxIterations === reference.config.maxIterations;
    if (routeMatches && iterMatches) {
      return { label: "Kondisi Identik", className: "same" };
    }
    if (routeMatches) {
      return { label: "Batas Iterasi Beda", className: "different" };
    }
    return { label: "Rute Awal Beda", className: "different" };
  }
  return { label: "Dataset Sama", className: "neutral" };
}

function formatStageDurations(run: RunResult) {
  const d = run.durations;
  if (!d) {
    return {
      main: `${(run.durationMs / 1000).toFixed(2)}s`,
      sub: null,
    };
  }
  const parts: string[] = [];
  if (d.constructionMs !== undefined && d.constructionMs > 0) {
    parts.push(`K: ${d.constructionMs.toFixed(0)}ms`);
  }
  if (d.preparationMs !== undefined && d.preparationMs > 0) {
    parts.push(`P: ${d.preparationMs.toFixed(0)}ms`);
  }
  if (d.searchMs !== undefined && d.searchMs > 0) {
    parts.push(`S: ${d.searchMs.toFixed(0)}ms`);
  }
  return {
    main: `${(d.totalMs / 1000).toFixed(2)}s`,
    sub: parts.length > 0 ? parts.join(" · ") : null,
  };
}

export function ReportView({
  runs,
  activeRun,
  currentDataset,
  onSelectRun,
  onRemoveRun,
  onClearRuns,
  onBackToPlayground,
}: {
  runs: RunResult[];
  activeRun: RunResult | null;
  currentDataset: Dataset;
  onSelectRun: (id: string) => void;
  onRemoveRun: (id: string) => void;
  onClearRuns: () => void;
  onBackToPlayground: () => void;
}) {
  const [selectedRunId, setSelectedRunId] = useState<string>(activeRun?.id ?? runs[0]?.id ?? "");
  const [compareRunId, setCompareRunId] = useState<string>("");
  const [selectedStep, setSelectedStep] = useState<number>(-1);
  const [tab, setTab] = useState<"comparison" | "trace" | "matrix">("comparison");
  const [matrixSource, setMatrixSource] = useState<"canvas" | "run">("canvas");

  const run = runs.find((r) => r.id === selectedRunId) ?? activeRun ?? runs[0] ?? null;
  const compareRun = runs.find((r) => r.id === compareRunId) ?? null;

  const bestRunOverall =
    runs.length > 0
      ? runs.reduce((best, cur) => (cur.bestCost < best.bestCost ? cur : best), runs[0]!)
      : null;

  const nonConstructionRuns = runs.filter((r) => r.category !== "construction");
  const avgImprovement =
    nonConstructionRuns.length > 0
      ? nonConstructionRuns.reduce((acc, r) => {
          const imp =
            r.initialCost === 0 ? 0 : ((r.initialCost - r.bestCost) / r.initialCost) * 100;
          return acc + imp;
        }, 0) / nonConstructionRuns.length
      : null;

  const fastestDuration =
    runs.length > 0 ? Math.min(...runs.map((r) => r.durations?.totalMs ?? r.durationMs)) : 0;

  if (runs.length === 0 && !activeRun) {
    return (
      <div className="report-empty-container">
        <Empty title="Belum Ada Hasil Eksperimen">
          Jalankan metode secara mandiri (Pembentukan Solusi Awal, Local Search, atau Metaheuristik)
          di Playground untuk melihat analisis rute, durasi tiap fase komputasi, dan perbandingan
          performa di sini.
        </Empty>
        <div className="mt-4 flex justify-center">
          <Button onClick={onBackToPlayground}>
            <ArrowLeft size={16} /> Kembali ke Playground
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="report-view-container">
      {/* Report Header Bar */}
      <div className="report-header-bar">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBackToPlayground}>
            <ArrowLeft size={15} />
            <span>Kembali ke Playground</span>
          </Button>
          <div>
            <h2 className="report-title">Laporan & Perbandingan Eksperimen</h2>
            <span className="small muted">
              Total {runs.length} hasil run tersimpan dalam sesi ini (
              {runs.filter((r) => r.category === "construction").length} Konstruksi ·{" "}
              {runs.filter((r) => r.category === "local-search").length} Local Search ·{" "}
              {runs.filter((r) => r.category === "metaheuristic").length} Metaheuristik)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {run && (
            <Button size="sm" variant="outline" onClick={() => exportRun(run)}>
              <Download size={14} />
              Ekspor JSON Run Ini
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            disabled={runs.length === 0}
            onClick={() => exportComparison(runs)}
          >
            <Download size={14} />
            Ekspor CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            disabled={runs.length === 0}
            onClick={() => {
              if (window.confirm("Apakah Anda yakin ingin menghapus seluruh riwayat eksperimen?")) {
                onClearRuns();
              }
            }}
            title="Hapus seluruh riwayat run"
          >
            <Trash2 size={14} />
            <span>Bersihkan Riwayat</span>
          </Button>
        </div>
      </div>

      {/* Report Navigation Tabs */}
      <div className="report-tabs">
        <button
          type="button"
          className={`report-tab-btn ${tab === "comparison" ? "active" : ""}`}
          onClick={() => setTab("comparison")}
        >
          <TableProperties size={15} />
          <span>Tabel Perbandingan Leaderboard</span>
        </button>
        <button
          type="button"
          className={`report-tab-btn ${tab === "trace" ? "active" : ""}`}
          onClick={() => setTab("trace")}
          disabled={!run}
        >
          <Activity size={15} />
          <span>Analisis Detail & Trace ({run ? getMethodTitle(run) : "—"})</span>
        </button>
        <button
          type="button"
          className={`report-tab-btn ${tab === "matrix" ? "active" : ""}`}
          onClick={() => setTab("matrix")}
        >
          <Layers size={15} />
          <span>Matriks Jarak Interaktif</span>
        </button>
      </div>

      {/* Tab 1: Leaderboard Comparison Table */}
      {tab === "comparison" && (
        <div className="panel report-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LEADERBOARD PERFORMA</span>
              <h3>Bandingkan Seluruh Eksperimen</h3>
            </div>
            <span className="small muted">
              Satu iterasi TS mengevaluasi neighborhood penuh; SA mengevaluasi satu kandidat acak
              per langkah.
            </span>
          </div>

          <div className="table-scroll">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Kategori & Metode</th>
                  <th>Dataset</th>
                  <th>Jarak Awal → Akhir</th>
                  <th>Perbaikan (%)</th>
                  <th>Iterasi / Evaluasi</th>
                  <th>Waktu (Fase)</th>
                  <th>Konfigurasi</th>
                  <th>Kondisi</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((item, idx) => {
                  const isSelected = item.id === run?.id;
                  const catInfo = getCategoryBadge(item.category);
                  const isConstruction = item.category === "construction";
                  const isLocalSearch = item.category === "local-search";
                  const impr = isConstruction
                    ? null
                    : item.initialCost === 0
                      ? 0
                      : ((item.initialCost - item.bestCost) / item.initialCost) * 100;
                  const durationInfo = formatStageDurations(item);
                  const cond = evaluateCondition(item, runs[0] ?? null);

                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? "selected-row" : ""}
                      onClick={() => {
                        setSelectedRunId(item.id);
                        onSelectRun(item.id);
                      }}
                    >
                      <td>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${catInfo.badgeClass}`}
                          >
                            {catInfo.label}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            #{runs.length - idx}
                          </span>
                        </div>
                        <strong className="block text-sm">{getMethodTitle(item)}</strong>
                      </td>
                      <td>
                        <strong>{item.dataset.name}</strong>
                        <small>
                          {item.dataset.nodes.length} node · {item.dataset.unit}
                        </small>
                      </td>
                      <td>
                        {isConstruction ? (
                          <strong className="best-cell">{formatNumber(item.bestCost)}</strong>
                        ) : (
                          <>
                            <span className="muted line-through text-xs mr-1">
                              {formatNumber(item.initialCost)}
                            </span>
                            <strong className="best-cell">{formatNumber(item.bestCost)}</strong>
                          </>
                        )}
                      </td>
                      <td>
                        {impr !== null ? (
                          <span className="improvement-badge">
                            <TrendingDown size={12} /> {impr.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>
                      <td>
                        {isConstruction ? (
                          <span className="small text-slate-600">1 lintasan deterministik</span>
                        ) : isLocalSearch ? (
                          <>
                            {item.iterations} langkah
                            <small>{item.evaluations.toLocaleString("id-ID")} kandidat</small>
                          </>
                        ) : (
                          <>
                            {item.iterations.toLocaleString("id-ID")} iterasi
                            <small>{item.evaluations.toLocaleString("id-ID")} evaluasi</small>
                          </>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Clock size={11} className="text-slate-400" />
                          <span>{durationInfo.main}</span>
                        </div>
                        {durationInfo.sub && (
                          <small className="text-[10px] text-slate-500 font-mono">
                            {durationInfo.sub}
                          </small>
                        )}
                      </td>
                      <td>
                        {isConstruction ? (
                          <span className="small font-medium">Start: {item.config.startId}</span>
                        ) : isLocalSearch ? (
                          <>
                            <span className="small font-medium">
                              Basis: {item.config.initialMethod}
                            </span>
                            <small>Start: {item.config.startId}</small>
                          </>
                        ) : (
                          <>
                            <span className="small font-medium">
                              {item.config.initialMethod}
                              {item.config.improve && item.config.improve !== "none"
                                ? ` + ${item.config.improve}`
                                : ""}
                            </span>
                            <small>
                              {item.config.algorithm === "TS"
                                ? `tenure ${item.config.tenure}`
                                : `T₀ ${item.config.initialTemperature}, α ${item.config.coolingRate}`}
                            </small>
                          </>
                        )}
                      </td>
                      <td>
                        <span className={`condition-tag ${cond.className}`}>{cond.label}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Buka Detail"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRunId(item.id);
                              onSelectRun(item.id);
                              setTab("trace");
                            }}
                            title="Buka Analisis Detail"
                          >
                            <Activity size={14} />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectRun(item.id);
                              onBackToPlayground();
                            }}
                            title="Tampilkan di Kanvas Playground"
                          >
                            <Eye size={14} /> Kanvas
                          </Button>
                          <button
                            type="button"
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded transition"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveRun(item.id);
                            }}
                            title="Hapus run ini"
                            aria-label={`Hapus run #${runs.length - idx}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* KPI Summary Cards for Leaderboard */}
          {runs.length > 0 && (
            <div className="leaderboard-kpi-grid">
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Solusi Terbaik Global</span>
                  {bestRunOverall && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        getCategoryBadge(bestRunOverall.category).badgeClass
                      }`}
                    >
                      {getMethodTitle(bestRunOverall)}
                    </span>
                  )}
                </div>
                <strong className="kpi-card-value text-teal-800">
                  {formatNumber(bestRunOverall?.bestCost ?? 0)}
                </strong>
                <span className="kpi-card-sub">
                  Initial: {formatNumber(bestRunOverall?.initialCost ?? 0)} (
                  {bestRunOverall?.dataset.unit})
                </span>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Rata-rata Peningkatan</span>
                  <TrendingDown size={16} className="text-teal-700" />
                </div>
                <strong className="kpi-card-value text-teal-700">
                  {avgImprovement !== null ? `${avgImprovement.toFixed(2)}%` : "—"}
                </strong>
                <span className="kpi-card-sub">
                  {avgImprovement !== null
                    ? "Dari metode pencarian & metaheuristik"
                    : "Hanya metode konstruksi"}
                </span>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Komputasi Tercepat</span>
                  <Clock size={16} className="text-slate-400" />
                </div>
                <strong className="kpi-card-value">{(fastestDuration / 1000).toFixed(2)}s</strong>
                <span className="kpi-card-sub">Durasi total tersingkat</span>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Total Eksperimen</span>
                  <CheckCircle2 size={16} className="text-slate-400" />
                </div>
                <strong className="kpi-card-value">{runs.length}</strong>
                <span className="kpi-card-sub">Tersimpan dalam sesi aktif</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Trace & Detail View */}
      {tab === "trace" && run && (
        <div className="space-y-4">
          {/* Run Selector Pills Bar */}
          <div className="panel run-selector-panel">
            <div className="flex items-center justify-between mb-2">
              <span className="eyebrow">PILIH EKSPERIMEN UNTUK DIANALISIS</span>
              <span className="text-xs text-slate-500">Klik salah satu untuk beralih</span>
            </div>
            <div className="run-chips-bar">
              {runs.map((r, i) => {
                const isSelected = r.id === run.id;
                const cat = getCategoryBadge(r.category);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`run-chip-btn ${isSelected ? "active" : ""}`}
                    onClick={() => {
                      setSelectedRunId(r.id);
                      onSelectRun(r.id);
                    }}
                  >
                    <span className={`chip-badge ${cat.badgeClass}`}>
                      #{runs.length - i} {r.config.algorithm}
                    </span>
                    <span className="chip-cost">{formatNumber(r.bestCost)}</span>
                    {isSelected && <CheckCircle2 size={13} className="chip-check" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Construction Run Detail Card */}
          {run.category === "construction" && (
            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    RUN #{runs.length - runs.findIndex((r) => r.id === run.id)} DARI {runs.length}{" "}
                    EKSPERIMEN
                  </span>
                  <h3 className="flex items-center gap-2">
                    <span>{getMethodTitle(run)}</span>
                    <span className="text-sm font-normal text-slate-500">· {run.dataset.name}</span>
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      onSelectRun(run.id);
                      onBackToPlayground();
                    }}
                  >
                    <Eye size={14} /> Lihat di Kanvas
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
                <div className="metric-cell primary">
                  <span className="metric-label">Jarak Total Rute</span>
                  <strong className="metric-value">{formatNumber(run.bestCost)}</strong>
                  <small className="metric-sub">{run.dataset.unit}</small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Titik Awal (Start Node)</span>
                  <strong className="metric-value">Node {run.config.startId}</strong>
                  <small className="metric-sub">{run.config.initialMethod}</small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Ukuran Rute</span>
                  <strong className="metric-value">{run.bestRoute.length} titik</strong>
                  <small className="metric-sub">Siklus tertutup</small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Waktu Konstruksi</span>
                  <strong className="metric-value">
                    {(run.durations?.constructionMs ?? run.durationMs).toFixed(2)}ms
                  </strong>
                  <small className="metric-sub">
                    {stopLabels[run.stopReason] ?? run.stopReason}
                  </small>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mt-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Urutan Kunjungan Node
                </h4>
                <div className="font-mono text-xs text-slate-800 bg-white p-3 rounded-lg border border-slate-200 overflow-x-auto whitespace-nowrap">
                  {run.bestRoute.join(" → ")} → {run.bestRoute[0]}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Metode konstruksi membentuk rute lengkap secara deterministik langsung dari
                  himpunan titik tanpa iterasi pertukaran (move). Rute ini dapat dijadikan baseline
                  murni atau solusi awal untuk optimasi lanjutan (Local Search / Metaheuristik).
                </p>
              </div>
            </div>
          )}

          {/* Local Search Run Detail Card */}
          {run.category === "local-search" && (
            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    RUN #{runs.length - runs.findIndex((r) => r.id === run.id)} DARI {runs.length}{" "}
                    EKSPERIMEN
                  </span>
                  <h3 className="flex items-center gap-2">
                    <span>{getMethodTitle(run)}</span>
                    <span className="text-sm font-normal text-slate-500">· {run.dataset.name}</span>
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      onSelectRun(run.id);
                      onBackToPlayground();
                    }}
                  >
                    <Eye size={14} /> Lihat di Kanvas
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
                <div className="metric-cell primary">
                  <span className="metric-label">Jarak Akhir Terbaik</span>
                  <strong className="metric-value">{formatNumber(run.bestCost)}</strong>
                  <small className="metric-sub">{run.dataset.unit}</small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Jarak Rute Dasar</span>
                  <strong className="metric-value">{formatNumber(run.initialCost)}</strong>
                  <small className="metric-sub">Basis: {run.config.initialMethod}</small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Langkah Perbaikan</span>
                  <strong className="metric-value">{run.iterations} langkah</strong>
                  <small className="metric-sub">
                    {run.evaluations.toLocaleString("id-ID")} kandidat dievaluasi
                  </small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Durasi Komputasi</span>
                  <strong className="metric-value">
                    {((run.durations?.totalMs ?? run.durationMs) / 1000).toFixed(2)}s
                  </strong>
                  <small className="metric-sub">
                    {stopLabels[run.stopReason] ?? run.stopReason}
                  </small>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Ringkasan Perbaikan Rute
                  </h4>
                  <span className="improvement-badge text-xs">
                    Perbaikan:{" "}
                    {(run.initialCost === 0
                      ? 0
                      : ((run.initialCost - run.bestCost) / run.initialCost) * 100
                    ).toFixed(2)}
                    %
                  </span>
                </div>
                <div className="text-xs space-y-1.5 text-slate-700">
                  <div>
                    <span className="text-slate-500">
                      Rute Dasar ({run.config.initialMethod}):{" "}
                    </span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      {run.initialRoute.join(" → ")} → {run.initialRoute[0]}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Rute Hasil Perbaikan: </span>
                    <span className="font-mono bg-teal-50 text-teal-900 px-2 py-0.5 rounded border border-teal-200">
                      {run.bestRoute.join(" → ")} → {run.bestRoute[0]}
                    </span>
                  </div>
                </div>
              </div>

              {run.trace.length > 0 && (
                <div className="mt-4">
                  <CostConvergenceChart run={run} compareRun={null} />
                  <TraceTableComponent
                    run={run}
                    selected={selectedStep}
                    onSelect={setSelectedStep}
                  />
                  {selectedStep >= 0 && run.trace[selectedStep] && (
                    <TraceDetailsComponent step={run.trace[selectedStep]!} dataset={run.dataset} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Metaheuristic Run Detail Card */}
          {run.category === "metaheuristic" && (
            <>
              <div className="panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      RUN #{runs.length - runs.findIndex((r) => r.id === run.id)} DARI {runs.length}{" "}
                      EKSPERIMEN
                    </span>
                    <h3 className="flex items-center gap-2">
                      <span>{getMethodTitle(run)}</span>
                      <span className="text-sm font-normal text-slate-500">
                        · {run.dataset.name}
                      </span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        onSelectRun(run.id);
                        onBackToPlayground();
                      }}
                    >
                      <Eye size={14} /> Lihat di Kanvas
                    </Button>
                  </div>
                </div>

                {/* Parameter Banner */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 mb-4 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    <strong>Metode:</strong>{" "}
                    {run.config.algorithm === "TS" ? "Tabu Search" : "Simulated Annealing"}
                  </span>
                  <span>
                    <strong>Solusi Awal:</strong> {run.config.initialMethod}{" "}
                    {run.config.improve && run.config.improve !== "none"
                      ? `+ ${run.config.improve}`
                      : ""}{" "}
                    (Start: {run.config.startId})
                  </span>
                  <span>
                    <strong>Batas Iterasi:</strong> {run.config.maxIterations}
                  </span>
                  {run.config.algorithm === "TS" ? (
                    <span>
                      <strong>Tabu Tenure:</strong> {run.config.tenure} · Aspiration aktif
                    </span>
                  ) : (
                    <span>
                      <strong>SA Params:</strong> T₀={run.config.initialTemperature}, α=
                      {run.config.coolingRate}, Seed={run.config.seed}, Tmin=
                      {run.config.minimumTemperature ?? 0.001}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
                  <div className="metric-cell primary">
                    <span className="metric-label">Jarak Akhir Terbaik</span>
                    <strong className="metric-value">{formatNumber(run.bestCost)}</strong>
                    <small className="metric-sub">{run.dataset.unit}</small>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-label">Jarak Solusi Awal</span>
                    <strong className="metric-value">{formatNumber(run.initialCost)}</strong>
                    <small className="metric-sub">{run.config.initialMethod}</small>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-label">Total Evaluasi</span>
                    <strong className="metric-value">
                      {run.evaluations.toLocaleString("id-ID")}
                    </strong>
                    <small className="metric-sub">{run.iterations} iterasi</small>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-label">Durasi Komputasi</span>
                    <strong className="metric-value">
                      {((run.durations?.totalMs ?? run.durationMs) / 1000).toFixed(2)}s
                    </strong>
                    <small className="metric-sub">
                      {stopLabels[run.stopReason] ?? run.stopReason}
                    </small>
                  </div>
                </div>

                {/* Compare With Secondary Run Option */}
                {runs.length > 1 && (
                  <div className="flex items-center gap-3 text-xs text-slate-600 my-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-1.5 font-medium text-slate-700 whitespace-nowrap">
                      <GitCompare size={15} className="text-teal-700" />
                      <span>Bandingkan kurva:</span>
                    </div>
                    <div className="max-w-xs flex-1">
                      <Select
                        value={compareRunId}
                        onChange={(val) => setCompareRunId(val)}
                        placeholder="Pilih run pembanding..."
                        options={[
                          { value: "", label: "(Tanpa pembanding)" },
                          ...runs
                            .filter((r) => r.id !== run.id && r.trace.length > 0)
                            .map((r, i) => ({
                              value: r.id,
                              label: `Run #${runs.length - (i >= runs.findIndex((x) => x.id === run.id) ? i + 1 : i)}: ${getMethodTitle(
                                r,
                              )} (${formatNumber(r.bestCost)})`,
                              badge: r.config.algorithm,
                            })),
                        ]}
                      />
                    </div>
                    {compareRunId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCompareRunId("")}
                        className="text-xs text-red-600 hover:bg-red-50"
                      >
                        Batal bandingkan
                      </Button>
                    )}
                  </div>
                )}

                <CostConvergenceChart run={run} compareRun={compareRun} />
              </div>

              <div className="panel">
                <TraceTableComponent run={run} selected={selectedStep} onSelect={setSelectedStep} />
                {selectedStep >= 0 && run.trace[selectedStep] && (
                  <TraceDetailsComponent step={run.trace[selectedStep]!} dataset={run.dataset} />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 3: Interactive Distance Matrix */}
      {tab === "matrix" && (
        <div className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PENGUKURAN JARAK EUCLIDEAN</span>
              <h3>Matriks Jarak Antar Node</h3>
            </div>

            <div className="matrix-origin-toggle">
              <span className="text-xs text-slate-500 mr-2">Sumber Data:</span>
              <button
                type="button"
                className={`origin-btn ${matrixSource === "canvas" ? "active" : ""}`}
                onClick={() => setMatrixSource("canvas")}
              >
                ● Kanvas Terkini ({currentDataset.nodes.length} Node)
              </button>
              {run && (
                <button
                  type="button"
                  className={`origin-btn ${matrixSource === "run" ? "active" : ""}`}
                  onClick={() => setMatrixSource("run")}
                >
                  ○ Run #{runs.length - runs.findIndex((r) => r.id === run.id)} (
                  {run.dataset.nodes.length} Node)
                </button>
              )}
            </div>
          </div>

          <InteractiveMatrixComponent
            dataset={matrixSource === "canvas" ? currentDataset : (run?.dataset ?? currentDataset)}
            sourceLabel={
              matrixSource === "canvas"
                ? `Dataset Terkini pada Kanvas (${currentDataset.name})`
                : `Dataset yang digunakan pada Run #${runs.length - runs.findIndex((r) => r.id === run?.id)} (${run?.dataset.name})`
            }
          />
        </div>
      )}
    </div>
  );
}

function CostConvergenceChart({
  run,
  compareRun,
}: {
  run: RunResult;
  compareRun: RunResult | null;
}) {
  if (!run.trace.length) return null;
  const maxIters = Math.max(
    run.config.maxIterations,
    run.trace[run.trace.length - 1]?.iteration ?? 1,
    compareRun?.config.maxIterations ?? 1,
  );
  const sampled = run.trace.filter(
    (_, index) =>
      index % Math.max(1, Math.ceil(run.trace.length / 180)) === 0 ||
      index === run.trace.length - 1,
  );
  const compareSampled = compareRun
    ? compareRun.trace.filter(
        (_, index) =>
          index % Math.max(1, Math.ceil(compareRun.trace.length / 180)) === 0 ||
          index === compareRun.trace.length - 1,
      )
    : [];

  const values = [
    run.initialCost,
    ...sampled.flatMap((step) => [step.currentCost, step.bestCost]),
    ...(compareRun
      ? [compareRun.initialCost, ...compareSampled.flatMap((s) => [s.currentCost, s.bestCost])]
      : []),
  ];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.001);

  const line = (
    targetRun: RunResult,
    targetSampled: TraceStep[],
    key: "currentCost" | "bestCost",
  ) =>
    [{ iteration: 0, [key]: targetRun.initialCost }, ...targetSampled]
      .map(
        (step, index) =>
          `${index ? "L" : "M"}${30 + (step.iteration / maxIters) * 640},${
            94 - (((step[key] as number) - min) / span) * 68
          }`,
      )
      .join(" ");

  return (
    <div className="cost-chart">
      <div className="flex items-center justify-between small muted mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span>
            {run.config.algorithm}: Current <span className="chart-blue">— (Biru)</span> / Best{" "}
            <span className="chart-green font-bold">— (Hijau)</span>
          </span>
          {compareRun && (
            <span>
              Pembanding ({compareRun.config.algorithm}):{" "}
              <span className="text-amber-600 font-bold">— (Oranye)</span>
            </span>
          )}
        </div>
        <span className="text-xs">Berdasarkan total {run.trace.length} langkah evaluasi</span>
      </div>
      <svg viewBox="0 0 700 120" role="img" aria-label="Grafik biaya current dan best per iterasi">
        <path d="M30 94H670" stroke="#dce4df" />
        {/* Main Run */}
        <path
          d={line(run, sampled, "currentCost")}
          fill="none"
          stroke="#6996b6"
          strokeWidth="1.5"
        />
        <path d={line(run, sampled, "bestCost")} fill="none" stroke="#147469" strokeWidth="2.5" />

        {/* Secondary Comparison Run (if selected) */}
        {compareRun && (
          <path
            d={line(compareRun, compareSampled, "bestCost")}
            fill="none"
            stroke="#d97706"
            strokeWidth="2.2"
            strokeDasharray="4 3"
          />
        )}

        <text x="30" y="114" fontSize="10">
          Iterasi 0
        </text>
        <text x="670" y="114" textAnchor="end" fontSize="10">
          {maxIters} iterasi
        </text>
        <text x="3" y="23" fontSize="10">
          {max.toFixed(1)}
        </text>
      </svg>
    </div>
  );
}

function TraceTableComponent({
  run,
  selected,
  onSelect,
}: {
  run: RunResult;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(run.trace.length / pageSize));

  if (!run.trace.length) {
    return (
      <p className="notice">
        Run selesai tanpa move: {stopLabels[run.stopReason] ?? run.stopReason}. Rute awal tetap
        menjadi best-so-far.
      </p>
    );
  }

  return (
    <>
      <div className="trace-toolbar">
        <span className="small muted">Pilih iterasi untuk melihat keputusan algoritma.</span>
        <Button variant="ghost" size="sm" disabled={selected < 0} onClick={() => onSelect(-1)}>
          Reset Pilihan
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
                    onClick={() => onSelect(page * pageSize + index)}
                  >
                    #{step.iteration}
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
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((v) => v - 1)}
          >
            Sebelumnya
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((v) => v + 1)}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </>
  );
}

function TraceDetailsComponent({ step, dataset }: { step: TraceStep; dataset: Dataset }) {
  const edgeLabel = (key: string) =>
    key
      .split(":")
      .map((index) => dataset.nodes[Number(index)]?.id ?? index)
      .join("–");

  return (
    <div className="trace-detail" aria-live="polite">
      <strong>
        Iterasi {step.iteration} · Perubahan Biaya (Δ): {formatNumber(step.delta)}
      </strong>
      <p>{step.reason}</p>
      {step.temperature !== undefined ? (
        <p className="mono small">
          T = {formatNumber(step.temperature)} · Peluang terima = {step.probability?.toFixed(6)} ·
          Random draw = {step.draw?.toFixed(6) ?? "tidak diperlukan"}
        </p>
      ) : (
        <>
          <p className="small">
            Kandidat tabu: {step.tabu ? "Ya" : "Tidak"} · Aspiration:{" "}
            {step.aspiration ? "Ya" : "Tidak"}
          </p>
          <p className="small mono">
            Tabu list aktif:{" "}
            {step.tabuEdges
              ?.map(([edge, expiry]) => `${edgeLabel(edge)} ≤ iterasi ${expiry}`)
              .join("; ") || "kosong"}
          </p>
        </>
      )}
    </div>
  );
}

function InteractiveMatrixComponent({
  dataset,
  sourceLabel,
}: {
  dataset: Dataset;
  sourceLabel: string;
}) {
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);
  const matrix = distanceMatrix(dataset.nodes);

  const hoveredNodeA = hovered !== null ? dataset.nodes[hovered.row] : null;
  const hoveredNodeB = hovered !== null ? dataset.nodes[hovered.col] : null;
  const hoveredDistance = hovered !== null ? matrix[hovered.row]?.[hovered.col] : null;

  return (
    <div className="interactive-matrix-wrapper">
      <div className="matrix-source-banner">
        <span>
          Sumber: <strong>{sourceLabel}</strong>
        </span>
        <span>
          Aturan: <strong>Euclidean Planar Simetris</strong> ({dataset.unit})
        </span>
      </div>

      <div className="matrix-formula-banner">
        {hovered && hoveredNodeA && hoveredNodeB && typeof hoveredDistance === "number" ? (
          <div>
            <span className="text-teal-800 font-semibold">
              Jarak antara Node {hoveredNodeA.id} ({hoveredNodeA.x}, {hoveredNodeA.y}) dan Node{" "}
              {hoveredNodeB.id} ({hoveredNodeB.x}, {hoveredNodeB.y}):
            </span>
            {hovered.row === hovered.col ? (
              <span className="ml-2 font-mono text-slate-600">Jarak ke diri sendiri = 0.000</span>
            ) : (
              <span className="ml-2 font-mono text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                d = √(({hoveredNodeB.x} - {hoveredNodeA.x})² + ({hoveredNodeB.y} - {hoveredNodeA.y}
                )²) = {formatNumber(hoveredDistance)} {dataset.unit}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-500 italic">
            Arahkan kursor (hover) pada angka sel matriks untuk melihat formula perhitungan jarak
            antar node.
          </span>
        )}
      </div>

      <div className="table-scroll matrix-scroll">
        <table className="interactive-matrix-table">
          <thead>
            <tr>
              <th scope="col" className="matrix-corner-cell">
                Node / Titik
              </th>
              {dataset.nodes.map((node, colIdx) => (
                <th
                  scope="col"
                  key={node.id}
                  className={`matrix-col-header ${hovered?.col === colIdx ? "col-highlight" : ""}`}
                >
                  <span className="header-node-id">{node.id}</span>
                  <span className="header-coords">
                    ({node.x}, {node.y})
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIdx) => {
              const rowNode = dataset.nodes[rowIdx]!;
              const isRowHovered = hovered?.row === rowIdx;

              return (
                <tr key={rowIdx}>
                  <th
                    scope="row"
                    className={`matrix-row-header ${isRowHovered ? "row-highlight" : ""}`}
                  >
                    <span className="header-node-id">{rowNode.id}</span>
                    <span className="header-coords">
                      ({rowNode.x}, {rowNode.y})
                    </span>
                  </th>
                  {row.map((cost, colIdx) => {
                    const isDiagonal = rowIdx === colIdx;
                    const isCellHovered = hovered?.row === rowIdx && hovered?.col === colIdx;
                    const isCrosshair = (isRowHovered || hovered?.col === colIdx) && !isDiagonal;

                    return (
                      <td
                        key={colIdx}
                        className={`matrix-cell ${isDiagonal ? "diagonal" : ""} ${
                          isCellHovered ? "cell-hovered" : isCrosshair ? "crosshair-highlight" : ""
                        }`}
                        onMouseEnter={() => setHovered({ row: rowIdx, col: colIdx })}
                        onMouseLeave={() => setHovered(null)}
                      >
                        {formatNumber(cost)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
