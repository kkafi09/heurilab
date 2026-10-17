import { useState, useMemo } from "react";
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
  AlertTriangle,
  Info,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Button, Empty, formatNumber, stopLabels } from "../../components/ui";
import { Select } from "../../components/ui/select";
import { distanceMatrix, closedRoute, type Dataset, type Route } from "../../domain/tsp/model";
import {
  type RunResult,
  type TraceStep,
  type RunCategory,
  reconstruct,
  EPSILON,
} from "../../domain/algorithms/experiment";
import { exportComparison, exportRun } from "../../services/export";
import {
  formatDistance,
  formatPercent,
  formatDuration,
  formatStageBreakdown,
  getMethodDisplayName,
  getMethodShortLabel,
  areRoutesIdentical,
  evaluateComparisonCondition,
  calculateReportKPIs,
} from "./formatters";

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

const getMethodTitle = getMethodDisplayName;

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
  // Reference run untuk acuan perbandingan
  const [referenceRunId, setReferenceRunId] = useState<string>(activeRun?.id ?? runs[0]?.id ?? "");
  // Run terpilih untuk analisis detail/trace
  const [selectedRunId, setSelectedRunId] = useState<string>(activeRun?.id ?? runs[0]?.id ?? "");

  const [compareRunId, setCompareRunId] = useState<string>("");
  const [selectedStep, setSelectedStep] = useState<number>(-1);
  const [tab, setTab] = useState<"comparison" | "trace" | "matrix">("comparison");
  const [matrixSource, setMatrixSource] = useState<"canvas" | "run">("canvas");

  const [prevSelectedId, setPrevSelectedId] = useState(selectedRunId);
  if (prevSelectedId !== selectedRunId) {
    setPrevSelectedId(selectedRunId);
    setSelectedStep(-1);
    const target = runs.find((r) => r.id === selectedRunId);
    if (target && target.category === "metaheuristic") {
      const match = runs.find(
        (r) =>
          r.id !== target.id &&
          r.category === "metaheuristic" &&
          r.dataset.id === target.dataset.id &&
          r.trace.length > 0,
      );
      setCompareRunId(match ? match.id : "");
    } else {
      setCompareRunId("");
    }
  }

  // Fallback acuan: jika acuan saat ini tidak ditemukan (misal dihapus), gunakan activeRun atau run terbaru
  const reference = runs.find((r) => r.id === referenceRunId) ?? activeRun ?? runs[0] ?? null;
  const run = runs.find((r) => r.id === selectedRunId) ?? reference ?? runs[0] ?? null;
  const compareRun = runs.find((r) => r.id === compareRunId) ?? null;

  const kpis = calculateReportKPIs(runs, reference);
  const hasMetaheuristic = runs.some((r) => r.category === "metaheuristic");

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
        <div className="report-header-left">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToPlayground}
            aria-label="Kembali ke Playground"
          >
            <ArrowLeft size={15} />
            <span>Kembali ke Playground</span>
          </Button>
          <div>
            <h2 className="report-title">Laporan eksperimen</h2>
            <span className="small muted">
              Total {runs.length} hasil tersimpan dalam sesi ini (
              {runs.filter((r) => r.category === "construction").length} Konstruksi ·{" "}
              {runs.filter((r) => r.category === "local-search").length} Local Search ·{" "}
              {runs.filter((r) => r.category === "metaheuristic").length} Metaheuristik)
            </span>
          </div>
        </div>

        <div className="report-header-toolbar">
          {run && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportRun(run)}
              title={`Ekspor detail run #${runs.length - runs.findIndex((r) => r.id === run.id)}`}
            >
              <Download size={14} />
              <span>Ekspor JSON (#{run.id.slice(0, 6)})</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            disabled={runs.length === 0}
            onClick={() => exportComparison(runs)}
          >
            <Download size={14} />
            <span>Ekspor CSV</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="btn-danger-secondary"
            disabled={runs.length === 0}
            onClick={() => {
              if (window.confirm("Apakah Anda yakin ingin menghapus seluruh riwayat eksperimen?")) {
                onClearRuns();
              }
            }}
            title="Hapus seluruh riwayat eksperimen"
          >
            <Trash2 size={14} />
            <span>Hapus riwayat</span>
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
          <span>Perbandingan</span>
        </button>
        <button
          type="button"
          className={`report-tab-btn ${tab === "trace" ? "active" : ""}`}
          onClick={() => setTab("trace")}
          disabled={!run}
        >
          <Activity size={15} />
          <span>Detail & Trace</span>
        </button>
        <button
          type="button"
          className={`report-tab-btn ${tab === "matrix" ? "active" : ""}`}
          onClick={() => setTab("matrix")}
        >
          <Layers size={15} />
          <span>Matriks jarak</span>
        </button>
      </div>

      {/* Tab 1: Leaderboard Comparison Table */}
      {tab === "comparison" && (
        <div className="panel report-panel">
          <div className="section-heading">
            <div>
              <h3 className="section-title">Perbandingan hasil</h3>
              {reference && (
                <div className="reference-callout">
                  <span className="reference-tag">Acuan:</span>
                  <strong className="text-slate-800">
                    #{runs.length - runs.findIndex((r) => r.id === reference.id)} —{" "}
                    {getMethodDisplayName(reference)}
                  </strong>
                  <span className="text-xs text-slate-500">
                    ({reference.dataset.name} · #{reference.id.slice(0, 6)})
                  </span>
                </div>
              )}
            </div>
            {hasMetaheuristic && (
              <span className="small muted">
                Satu iterasi TS mengevaluasi seluruh neighborhood; SA mengevaluasi satu kandidat per
                langkah.
              </span>
            )}
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
                  const isReference = item.id === reference?.id;
                  const catInfo = getCategoryBadge(item.category);
                  const isConstruction = item.category === "construction";
                  const isLocalSearch = item.category === "local-search";

                  const isNoChange =
                    !isConstruction && Math.abs(item.initialCost - item.bestCost) <= EPSILON;
                  const isImproved = !isConstruction && item.initialCost > item.bestCost + EPSILON;
                  const rawImpr = isConstruction
                    ? null
                    : item.initialCost === 0
                      ? 0
                      : ((item.initialCost - item.bestCost) / item.initialCost) * 100;

                  const durationInfo = formatStageBreakdown(item);
                  const cond = evaluateComparisonCondition(item, reference);

                  return (
                    <tr
                      key={item.id}
                      className={`${isSelected ? "selected-row" : ""} ${isReference ? "reference-row" : ""}`}
                      onClick={() => {
                        setSelectedRunId(item.id);
                        setReferenceRunId(item.id);
                      }}
                      title="Klik untuk memilih sebagai acuan perbandingan dan analisis detail"
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
                        <strong className="block text-sm">{getMethodDisplayName(item)}</strong>
                      </td>
                      <td>
                        <strong>{item.dataset.name}</strong>
                        <small>
                          {item.dataset.nodes.length} node · {item.dataset.unit}
                        </small>
                      </td>
                      <td>
                        {isConstruction || isNoChange ? (
                          <strong className="best-cell font-tabular">
                            {formatDistance(item.bestCost)}
                          </strong>
                        ) : (
                          <>
                            <span className="muted line-through text-xs mr-1 font-tabular">
                              {formatDistance(item.initialCost)}
                            </span>
                            <strong className="best-cell font-tabular">
                              {formatDistance(item.bestCost)}
                            </strong>
                          </>
                        )}
                      </td>
                      <td>
                        {isConstruction ? (
                          <span className="text-slate-400 font-mono">—</span>
                        ) : isNoChange ? (
                          <span className="improvement-neutral">0,00% (Tidak berubah)</span>
                        ) : isImproved ? (
                          <span className="improvement-badge">
                            <TrendingDown size={12} />{" "}
                            {rawImpr! < 0.01 ? "<0,01%" : formatPercent(rawImpr!)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">
                            {formatPercent(rawImpr!)}
                          </span>
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
                          <span className="font-tabular font-medium">
                            {durationInfo.totalFormatted}
                          </span>
                        </div>
                        {durationInfo.summary && (
                          <small
                            className="text-[10px] text-slate-500 font-tabular"
                            title={durationInfo.parts
                              .map((p) => `${p.label}: ${p.formatted}`)
                              .join(", ")}
                          >
                            {durationInfo.summary}
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
                        <span className={`condition-tag ${cond.className}`} title={cond.tooltip}>
                          {cond.label}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Buka Detail run #${runs.length - idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRunId(item.id);
                              setReferenceRunId(item.id);
                              setTab("trace");
                            }}
                            title="Buka Analisis Detail"
                          >
                            <Activity size={14} /> Detail
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
                            className="delete-run-icon-btn"
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
                  <span className="kpi-card-title">Jarak terendah pada dataset acuan</span>
                  {kpis.bestDistance && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        kpis.bestDistance.isTie
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-teal-100 text-teal-800 border border-teal-200"
                      }`}
                    >
                      {kpis.bestDistance.methodsLabel}
                    </span>
                  )}
                </div>
                <strong className="kpi-card-value text-teal-800">
                  {kpis.bestDistance ? kpis.bestDistance.valueFormatted : "—"}
                </strong>
                <span className="kpi-card-sub">
                  {kpis.bestDistance
                    ? kpis.bestDistance.subLabel
                    : "Belum ada hasil selesai pada dataset acuan"}
                </span>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Rata-rata perbaikan kelompok sebanding</span>
                  <TrendingDown size={16} className="text-teal-700" />
                </div>
                <strong className="kpi-card-value text-teal-700">
                  {kpis.avgImprovement ? kpis.avgImprovement.valueFormatted : "—"}
                </strong>
                <span className="kpi-card-sub">
                  {kpis.avgImprovement
                    ? kpis.avgImprovement.subLabel
                    : "Perlu minimal 2 hasil sebanding"}
                </span>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Durasi total terendah dalam kelompok</span>
                  <Clock size={16} className="text-slate-400" />
                </div>
                <strong className="kpi-card-value">
                  {kpis.fastestDuration ? kpis.fastestDuration.valueFormatted : "—"}
                </strong>
                <span className="kpi-card-sub">
                  {kpis.fastestDuration
                    ? kpis.fastestDuration.subLabel
                    : "Perlu minimal 2 hasil sebanding"}
                </span>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Total eksperimen</span>
                  <CheckCircle2 size={16} className="text-slate-400" />
                </div>
                <strong className="kpi-card-value">{kpis.totalRuns.count}</strong>
                <span className="kpi-card-sub">{kpis.totalRuns.subLabel}</span>
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
                      #{runs.length - i} {getMethodShortLabel(r)}
                    </span>
                    <span className="chip-cost font-tabular">{formatDistance(r.bestCost)}</span>
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
                    <span>{getMethodDisplayName(run)}</span>
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
                  <strong className="metric-value font-tabular">
                    {formatDistance(run.bestCost)}
                  </strong>
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
                  <strong className="metric-value font-tabular">
                    {formatDuration(run.durations?.constructionMs ?? run.durationMs)}
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
                  {closedRoute(run.bestRoute, run.dataset).join(" → ")}
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
                    <span>{getMethodDisplayName(run)}</span>
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
                  <strong className="metric-value font-tabular">
                    {formatDistance(run.bestCost)}
                  </strong>
                  <small className="metric-sub">{run.dataset.unit}</small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Jarak Rute Dasar</span>
                  <strong className="metric-value font-tabular">
                    {formatDistance(run.initialCost)}
                  </strong>
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
                  <strong className="metric-value font-tabular">
                    {formatDuration(run.durations?.totalMs ?? run.durationMs)}
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
                      {closedRoute(run.initialRoute, run.dataset).join(" → ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Rute Hasil Perbaikan: </span>
                    <span className="font-mono bg-teal-50 text-teal-900 px-2 py-0.5 rounded border border-teal-200">
                      {closedRoute(run.bestRoute, run.dataset).join(" → ")}
                    </span>
                  </div>
                </div>
              </div>

              {run.trace.length > 0 && (
                <div className="mt-4">
                  <CostConvergenceChart run={run} compareRun={null} />
                  <TraceReplayViewer
                    run={run}
                    selectedStep={selectedStep}
                    onSelectStep={setSelectedStep}
                  />
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
                    <strong className="metric-value font-tabular">
                      {formatDistance(run.bestCost)}
                    </strong>
                    <small className="metric-sub">{run.dataset.unit}</small>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-label">Jarak Solusi Awal</span>
                    <strong className="metric-value font-tabular">
                      {formatDistance(run.initialCost)}
                    </strong>
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
                    <strong className="metric-value font-tabular">
                      {formatDuration(run.durations?.totalMs ?? run.durationMs)}
                    </strong>
                    <small className="metric-sub">
                      {stopLabels[run.stopReason] ?? run.stopReason}
                    </small>
                  </div>
                </div>

                {/* Route Tour Details */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 my-3">
                  <div>
                    <span className="text-slate-500 font-medium">Rute Solusi Awal: </span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      {closedRoute(run.initialRoute, run.dataset).join(" → ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-teal-700 font-medium">Rute Terbaik Akhir: </span>
                    <span className="font-mono bg-teal-50 text-teal-900 px-2 py-0.5 rounded border border-teal-200">
                      {closedRoute(run.bestRoute, run.dataset).join(" → ")}
                    </span>
                  </div>
                </div>

                {/* Compare With Secondary Run Option */}
                {runs.length > 1 && (
                  <div className="space-y-2 my-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-center gap-3">
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
                              .map((r) => {
                                const runNumber =
                                  runs.length - runs.findIndex((x) => x.id === r.id);
                                const isSameDataset = r.dataset.id === run.dataset.id;
                                const isSameInitial = areRoutesIdentical(
                                  r.initialRoute,
                                  run.initialRoute,
                                );
                                const tag =
                                  isSameDataset && isSameInitial
                                    ? " [Sebanding]"
                                    : isSameDataset
                                      ? " [Beda Rute]"
                                      : " [Beda Dataset]";
                                return {
                                  value: r.id,
                                  label: `Run #${runNumber}: ${getMethodDisplayName(r)} (${formatDistance(r.bestCost)})${tag}`,
                                  badge: r.config.algorithm,
                                };
                              }),
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

                    {compareRun && compareRun.dataset.id !== run.dataset.id && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                        <span>
                          <strong>Peringatan Kondisi:</strong> Run pembanding #
                          {runs.length - runs.findIndex((x) => x.id === compareRun.id)} menggunakan
                          dataset berbeda ({compareRun.dataset.name} vs {run.dataset.name}). Skala
                          sumbu biaya tidak ekuivalen.
                        </span>
                      </div>
                    )}

                    {compareRun &&
                      compareRun.dataset.id === run.dataset.id &&
                      !areRoutesIdentical(compareRun.initialRoute, run.initialRoute) && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-blue-800 flex items-center gap-2">
                          <Info size={14} className="text-blue-600 shrink-0" />
                          <span>
                            <strong>Catatan:</strong> Run pembanding #
                            {runs.length - runs.findIndex((x) => x.id === compareRun.id)}{" "}
                            menggunakan rute awal berbeda.
                          </span>
                        </div>
                      )}
                  </div>
                )}

                <CostConvergenceChart run={run} compareRun={compareRun} />
              </div>

              <div className="panel">
                <TraceReplayViewer
                  run={run}
                  selectedStep={selectedStep}
                  onSelectStep={setSelectedStep}
                />
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

function TraceReplayViewer({
  run,
  selectedStep,
  onSelectStep,
}: {
  run: RunResult;
  selectedStep: number;
  onSelectStep: (step: number) => void;
}) {
  const hasTrace = run.trace.length > 0;
  const isReplaying = selectedStep >= 0 && selectedStep < run.trace.length;
  const activeIndex = isReplaying ? selectedStep : Math.max(0, run.trace.length - 1);
  const step = run.trace[activeIndex];

  const { current, candidate, best } = useMemo(
    () =>
      hasTrace
        ? reconstruct(run, activeIndex)
        : { current: run.bestRoute, candidate: null, best: run.bestRoute },
    [hasTrace, run, activeIndex],
  );

  const nodes = run.dataset.nodes;
  const { midX, midY, scale } = useMemo(() => {
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = xs.length ? Math.min(...xs) : -10;
    const maxX = xs.length ? Math.max(...xs) : 10;
    const minY = ys.length ? Math.min(...ys) : -10;
    const maxY = ys.length ? Math.max(...ys) : 10;
    const computedMidX = (minX + maxX) / 2;
    const computedMidY = (minY + maxY) / 2;
    const effectiveSpanX = Math.max(maxX - minX, 14);
    const effectiveSpanY = Math.max(maxY - minY, 9);
    const computedScale = Math.min(560 / effectiveSpanX, 240 / effectiveSpanY);
    return { midX: computedMidX, midY: computedMidY, scale: computedScale };
  }, [nodes]);

  if (!hasTrace || !step) return null;

  const project = (x: number, y: number) => ({
    x: 300 + (x - midX) * scale,
    y: 140 - (y - midY) * scale,
  });

  const getPathD = (route: Route) => {
    if (route.length < 2) return "";
    return (
      route
        .map((idx, i) => {
          const node = nodes[idx];
          if (!node) return "";
          const p = project(node.x, node.y);
          return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        })
        .join(" ") + " Z"
    );
  };

  const isAccepted = step.accepted;
  const isAspiration = step.aspiration;
  const isTabu = step.tabu;

  return (
    <div className="trace-replay-card">
      <div className="trace-replay-header">
        <div className="flex items-center gap-2">
          <span className="eyebrow">REPLAY TRACE ITERASI</span>
          <span className="replay-step-pill">
            Iterasi #{step.iteration} dari {run.trace.length}
          </span>
          <span
            className={`decision-badge px-2 py-0.5 rounded text-xs font-semibold border ${
              isAspiration
                ? "bg-purple-100 text-purple-800 border-purple-300"
                : isAccepted
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-rose-100 text-rose-800 border-rose-300"
            }`}
          >
            {isAspiration ? "Aspiration Diterima" : isAccepted ? "Diterima" : "Ditolak"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            disabled={activeIndex <= 0}
            onClick={() => onSelectStep(0)}
            title="Langkah Pertama"
          >
            <SkipBack size={13} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={activeIndex <= 0}
            onClick={() => onSelectStep(Math.max(0, activeIndex - 1))}
            title="Langkah Sebelumnya"
          >
            <ChevronLeft size={13} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={activeIndex >= run.trace.length - 1}
            onClick={() => onSelectStep(Math.min(run.trace.length - 1, activeIndex + 1))}
            title="Langkah Berikutnya"
          >
            <ChevronRight size={13} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={activeIndex >= run.trace.length - 1}
            onClick={() => onSelectStep(run.trace.length - 1)}
            title="Langkah Terakhir"
          >
            <SkipForward size={13} />
          </Button>
          {isReplaying && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSelectStep(-1)}
              className="text-xs ml-1"
              title="Kembali ke rute akhir"
            >
              <RotateCcw size={12} /> Keluar Replay
            </Button>
          )}
        </div>
      </div>

      <div className="replay-slider-row">
        <input
          type="range"
          min={0}
          max={run.trace.length - 1}
          value={activeIndex}
          onChange={(e) => onSelectStep(Number(e.target.value))}
          className="replay-slider"
          aria-label="Pilih nomor iterasi"
        />
      </div>

      <div className="replay-content-grid">
        <div className="replay-canvas-wrapper">
          <svg viewBox="0 0 600 280" className="replay-svg">
            <defs>
              <pattern id="replayGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#f1f5f9" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="600" height="280" fill="url(#replayGrid)" rx="8" />

            {/* Layer 1: Initial Route */}
            {run.initialRoute.length > 2 && (
              <path
                d={getPathD(run.initialRoute)}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.8"
              />
            )}

            {/* Layer 2: Current Route */}
            {current.length > 2 && (
              <path
                d={getPathD(current)}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="2.2"
                strokeDasharray="6 4"
                opacity="0.9"
              />
            )}

            {/* Layer 3: Candidate Route */}
            {candidate && candidate.length > 2 && (
              <path
                d={getPathD(candidate)}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.4"
                strokeDasharray="4 4"
                opacity="0.95"
              />
            )}

            {/* Layer 4: Best-so-far Route */}
            {best.length > 2 && (
              <path
                d={getPathD(best)}
                fill="none"
                stroke="#0d9488"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            )}

            {/* Layer 5: Nodes & IDs */}
            {nodes.map((node) => {
              const p = project(node.x, node.y);
              const isStart = node.id === run.config.startId;
              return (
                <g key={node.id}>
                  {isStart && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={14}
                      fill="#ccfbf1"
                      stroke="#0d9488"
                      strokeWidth={1.5}
                      opacity="0.6"
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isStart ? 9 : 7}
                    fill={isStart ? "#14b8a6" : "#ffffff"}
                    stroke={isStart ? "#0f766e" : "#334155"}
                    strokeWidth={2}
                  />
                  <text
                    x={p.x}
                    y={p.y - 11}
                    textAnchor="middle"
                    className="text-[10px] font-semibold fill-slate-700 pointer-events-none"
                  >
                    {node.id}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="replay-legend">
            <span className="legend-item">
              <span className="legend-line initial" /> Rute Awal
            </span>
            <span className="legend-item">
              <span className="legend-line current" /> Current
            </span>
            <span className="legend-item">
              <span className="legend-line candidate" /> Kandidat Move
            </span>
            <span className="legend-item">
              <span className="legend-line best" /> Best-so-far
            </span>
          </div>
        </div>

        <div className="replay-info-panel">
          <div className="metric-cell primary p-2.5">
            <span className="metric-label">Jarak Kandidat (d_cand)</span>
            <strong className="metric-value font-tabular">
              {formatDistance(step.candidateCost)}
            </strong>
            <small className="metric-sub">
              Δ = {step.delta > 0 ? "+" : ""}
              {formatDistance(step.delta)} {run.dataset.unit}
            </small>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block">Current Tour:</span>
              <strong className="font-tabular text-slate-800">
                {formatDistance(step.currentCost)}
              </strong>
            </div>
            <div className="p-2 bg-teal-50 border border-teal-200 rounded-lg">
              <span className="text-teal-700 block">Best-so-far:</span>
              <strong className="font-tabular text-teal-900">
                {formatDistance(step.bestCost)}
              </strong>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="font-medium text-slate-700">Keputusan Iterasi:</div>
            <p className="text-slate-600">{step.reason}</p>
            {run.config.algorithm === "TS" ? (
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                <span>
                  Move 2-OPT ({step.move.i}, {step.move.j}) ·{" "}
                </span>
                <span>Tabu: {isTabu ? "Ya" : "Tidak"} · </span>
                <span>Aspiration: {isAspiration ? "Ya" : "Tidak"}</span>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 font-mono">
                <span>T = {formatNumber(step.temperature ?? 0)} · </span>
                <span>P = {step.probability?.toFixed(6) ?? "—"} · </span>
                <span>Draw = {step.draw?.toFixed(6) ?? "—"}</span>
              </div>
            )}
          </div>
        </div>
      </div>
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
  const [prevRunId, setPrevRunId] = useState(run.id);

  if (prevRunId !== run.id) {
    setPrevRunId(run.id);
    setPage(0);
  }

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(run.trace.length / pageSize));
  const safePage = Math.min(page, Math.max(0, totalPages - 1));

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
            {run.trace.slice(safePage * pageSize, (safePage + 1) * pageSize).map((step, index) => (
              <tr
                key={step.iteration}
                className={selected === safePage * pageSize + index ? "selected-row" : ""}
              >
                <td>
                  <button
                    type="button"
                    className="step-button"
                    onClick={() => onSelect(safePage * pageSize + index)}
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
          {run.trace.length.toLocaleString("id-ID")} langkah · halaman {safePage + 1}/{totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage((v) => Math.max(0, v - 1))}
          >
            Sebelumnya
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={safePage + 1 >= totalPages}
            onClick={() => setPage((v) => Math.min(totalPages - 1, v + 1))}
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
