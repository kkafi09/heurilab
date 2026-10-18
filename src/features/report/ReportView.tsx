import { useState, useMemo, useRef, useEffect } from "react";
import {
  Download,
  ArrowLeft,
  Activity,
  TableProperties,
  TrendingDown,
  Layers,
  Eye,
  Trash2,
  AlertTriangle,
  Info,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  ArrowRightLeft,
} from "lucide-react";
import { Button, Empty, formatNumber, stopLabels } from "../../components/ui";
import { Select } from "../../components/ui/select";
import {
  distanceMatrix,
  closedRoute,
  datasetKey,
  type Dataset,
  type Route,
} from "../../domain/tsp/model";
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
  areRoutesIdentical,
  evaluatePairComparability,
  getRunIdentity,
  isDatasetIdentical,
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

function findDefaultBId(runs: RunResult[], aId: string): string {
  const targetA = runs.find((r) => r.id === aId);
  if (!targetA || runs.length < 2) return "";

  const compAlg =
    targetA.config.algorithm === "TS"
      ? "SA"
      : targetA.config.algorithm === "SA"
        ? "TS"
        : targetA.config.algorithm === "2OPT" || targetA.config.improve === "2OPT"
          ? "3OPT"
          : targetA.config.algorithm === "3OPT" || targetA.config.improve === "3OPT"
            ? "2OPT"
            : null;

  if (compAlg) {
    const match = runs.find(
      (r) =>
        r.id !== targetA.id &&
        isDatasetIdentical(r.dataset, targetA.dataset) &&
        (r.config.algorithm === compAlg || r.config.improve === compAlg) &&
        areRoutesIdentical(r.initialRoute, targetA.initialRoute),
    );
    if (match) return match.id;
  }

  if (targetA.category === "construction") {
    const sameCatConstruct = runs.find(
      (r) =>
        r.id !== targetA.id &&
        r.category === "construction" &&
        isDatasetIdentical(r.dataset, targetA.dataset),
    );
    if (sameCatConstruct) return sameCatConstruct.id;
  }

  const sameCat = runs.find(
    (r) =>
      r.id !== targetA.id &&
      r.category === targetA.category &&
      isDatasetIdentical(r.dataset, targetA.dataset),
  );
  if (sameCat) return sameCat.id;

  const sameData = runs.find(
    (r) => r.id !== targetA.id && isDatasetIdentical(r.dataset, targetA.dataset),
  );
  if (sameData) return sameData.id;

  const second = runs.find((r) => r.id !== targetA.id);
  return second ? second.id : "";
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
  const [runAId, setRunAId] = useState<string>(() => activeRun?.id ?? runs[0]?.id ?? "");
  const [runBId, setRunBId] = useState<string>(() => {
    const aId = activeRun?.id ?? runs[0]?.id ?? "";
    return findDefaultBId(runs, aId);
  });

  // Sumber analisis tab Detail & Trace: "A" atau "B"
  const [detailSource, setDetailSource] = useState<"A" | "B">("A");
  const [tab, setTab] = useState<"comparison" | "trace" | "matrix">("comparison");
  const [matrixSource, setMatrixSource] = useState<"A" | "B" | "canvas">("A");

  // Replay mode pada tab Detail: "final" (rute hasil akhir) atau "iterating" (telusuri iterasi)
  const [selectedStep, setSelectedStep] = useState<number>(-1);

  // Bagian riwayat pendukung (tertutup secara default)
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Rincian kondisi kesebandingan
  const [showConditionDetails, setShowConditionDetails] = useState(false);

  // Dropdown menu ekspor terpadu
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    }
    if (isExportOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isExportOpen]);

  // State adjustment untuk pergantian run
  const runA = runs.find((r) => r.id === runAId) ?? (runs.length > 0 ? runs[0]! : null);
  const runB = runs.find((r) => r.id === runBId) ?? null;

  // Run aktif pada tab Detail & Trace
  const detailRun = detailSource === "B" && runB ? runB : runA;

  const [prevDetailId, setPrevDetailId] = useState<string>(detailRun?.id ?? "");
  if (detailRun && prevDetailId !== detailRun.id) {
    setPrevDetailId(detailRun.id);
    setSelectedStep(-1);
  }

  const handleSelectA = (newAId: string) => {
    setRunAId(newAId);
    if (newAId === runBId) {
      setRunBId("");
    }
  };

  const handleSelectB = (newBId: string) => {
    if (newBId === runAId) return;
    setRunBId(newBId);
  };

  const handleSwapAB = () => {
    if (!runA || !runB) return;
    const prevA = runA.id;
    const prevB = runB.id;
    setRunAId(prevB);
    setRunBId(prevA);
  };

  if (runs.length === 0 && !activeRun) {
    return (
      <div className="report-empty-container">
        <Empty title="Belum Ada Hasil Eksperimen">
          Jalankan metode secara mandiri (Pembentukan Solusi Awal, Local Search, atau Metaheuristik)
          di Playground untuk melihat analisis rute, perbandingan dua hasil, dan evaluasi kondisi
          kesebandingan di sini.
        </Empty>
        <div className="mt-4 flex justify-center">
          <Button onClick={onBackToPlayground}>
            <ArrowLeft size={16} /> Kembali ke Playground
          </Button>
        </div>
      </div>
    );
  }

  const idA = runA ? getRunIdentity(runA, runs) : null;
  const idB = runB ? getRunIdentity(runB, runs) : null;
  const pairComp = runA && runB ? evaluatePairComparability(runA, runB) : null;

  // Active dataset untuk tab Matriks Jarak
  let activeMatrixDataset: Dataset | null = null;
  let activeSourceTitle = "";
  let activeSourceType: "snapshot" | "canvas" = "snapshot";
  let activeSourceDetail = "";

  if (matrixSource === "A") {
    if (runA) {
      activeMatrixDataset = runA.dataset;
      activeSourceTitle = `Hasil A — ${getMethodDisplayName(runA)}`;
      activeSourceType = "snapshot";
      activeSourceDetail = `Snapshot hasil tersimpan #${runA.id.slice(0, 6)} (Run #${idA?.runNumber ?? 1})`;
    }
  } else if (matrixSource === "B") {
    if (runB) {
      activeMatrixDataset = runB.dataset;
      activeSourceTitle = `Hasil B — ${getMethodDisplayName(runB)}`;
      activeSourceType = "snapshot";
      activeSourceDetail = `Snapshot hasil tersimpan #${runB.id.slice(0, 6)} (Run #${idB?.runNumber ?? 2})`;
    }
  } else if (matrixSource === "canvas") {
    activeMatrixDataset = currentDataset;
    activeSourceTitle = "Data kerja di kanvas";
    activeSourceType = "canvas";
    activeSourceDetail = "Data koordinat aktif di Playground saat ini";
  }

  const matrixSourceOptions = [
    ...(runA ? [{ value: "A", label: `Hasil A — ${getMethodDisplayName(runA)}` }] : []),
    ...(runB ? [{ value: "B", label: `Hasil B — ${getMethodDisplayName(runB)}` }] : []),
    { value: "canvas", label: "Data kerja di kanvas" },
  ];

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
          {/* Menu Dropdown Ekspor Terpadu */}
          <div className="export-dropdown-wrapper" ref={exportRef}>
            <Button
              size="sm"
              variant="outline"
              disabled={runs.length === 0}
              onClick={() => setIsExportOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={isExportOpen}
              aria-label="Pilihan Ekspor"
              title="Buka pilihan unduh/ekspor eksperimen"
            >
              <Download size={14} />
              <span>Ekspor</span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-150 ${isExportOpen ? "rotate-180" : ""}`}
              />
            </Button>

            {isExportOpen && (
              <div
                className="export-menu-popover"
                role="menu"
                tabIndex={-1}
                aria-label="Pilihan format ekspor"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsExportOpen(false);
                  }
                }}
              >
                {/* 1. CSV Pasangan A/B */}
                <button
                  type="button"
                  role="menuitem"
                  className="export-menu-item"
                  disabled={!runA || !runB}
                  onClick={() => {
                    if (runA && runB) {
                      exportComparison([runA, runB], "heurilab-perbandingan.csv", {
                        [runA.id]: "A",
                        [runB.id]: "B",
                      });
                      setIsExportOpen(false);
                    }
                  }}
                  title={!runB ? "Pilih Hasil B terlebih dahulu di tab Perbandingan" : undefined}
                >
                  <div className="font-semibold text-xs text-slate-800">CSV pasangan A/B</div>
                  <div className="text-[11px] text-slate-500">
                    {runA && runB
                      ? "Tabel perbandingan berdampingan dengan kolom penanda sisi A dan B"
                      : "Memerlukan Hasil A dan Hasil B aktif"}
                  </div>
                </button>

                {/* 2. JSON Hasil A */}
                <button
                  type="button"
                  role="menuitem"
                  className="export-menu-item"
                  disabled={!runA}
                  onClick={() => {
                    if (runA) {
                      exportRun(runA);
                      setIsExportOpen(false);
                    }
                  }}
                >
                  <div className="font-semibold text-xs text-slate-800">
                    JSON Hasil A {runA ? `(#${runA.id.slice(0, 6)})` : ""}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {runA
                      ? `Detail run dan trace lengkap ${getMethodDisplayName(runA)}`
                      : "Hasil A belum dipilih"}
                  </div>
                </button>

                {/* 3. JSON Hasil B */}
                <button
                  type="button"
                  role="menuitem"
                  className="export-menu-item"
                  disabled={!runB}
                  onClick={() => {
                    if (runB) {
                      exportRun(runB);
                      setIsExportOpen(false);
                    }
                  }}
                >
                  <div className="font-semibold text-xs text-slate-800">
                    JSON Hasil B {runB ? `(#${runB.id.slice(0, 6)})` : ""}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {runB
                      ? `Detail run dan trace lengkap ${getMethodDisplayName(runB)}`
                      : "Hasil B belum dipilih"}
                  </div>
                </button>

                {/* 4. CSV Semua Riwayat */}
                <button
                  type="button"
                  role="menuitem"
                  className="export-menu-item"
                  disabled={runs.length === 0}
                  onClick={() => {
                    exportComparison(runs, "heurilab-semua-riwayat.csv");
                    setIsExportOpen(false);
                  }}
                >
                  <div className="font-semibold text-xs text-slate-800">CSV semua riwayat</div>
                  <div className="text-[11px] text-slate-500">
                    Ringkasan seluruh {runs.length} hasil eksperimen sesi ini
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Hapus Riwayat */}
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
            title="Hapus seluruh riwayat eksperimen sesi"
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
          disabled={!detailRun}
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

      {/* =========================================================================
          TAB 1: PERBANDINGAN DUA HASIL (A vs B)
          ========================================================================= */}
      {tab === "comparison" && (
        <div className="panel report-panel">
          <div className="section-heading mb-3">
            <div>
              <h3 className="section-title">Perbandingan hasil</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih Hasil A dan Hasil B untuk mengevaluasi kesebandingan kondisi dan membandingkan
                performa langsung.
              </p>
            </div>
          </div>

          {/* 1. Selector A/B Grid */}
          <div className="ab-selector-grid">
            {/* Card Hasil A */}
            <div className="ab-card side-a">
              <div className="ab-card-header">
                <div className="flex items-center gap-1.5">
                  <span className="reference-tag text-xs text-slate-500 font-semibold">Acuan:</span>
                  <span className="side-pill side-a">Hasil A</span>
                </div>
                {idA && <span className="run-id-pill">#{idA.shortId}</span>}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 block">
                  Pilih Eksperimen A:
                </span>
                <Select
                  value={runA?.id ?? ""}
                  onChange={handleSelectA}
                  options={runs.map((r) => {
                    const ident = getRunIdentity(r, runs);
                    const isB = r.id === runB?.id;
                    return {
                      value: r.id,
                      label: `${ident.fullLabel} (${formatDistance(r.bestCost)})${isB ? " — [Dipilih sebagai B]" : ""}`,
                      badge: r.config.algorithm,
                      disabled: isB,
                    };
                  })}
                />
              </div>

              {runA && (
                <div className="ab-meta-grid">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Metode:</span>
                    <strong className="text-xs text-slate-800">{getMethodDisplayName(runA)}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Dataset:</span>
                    <strong className="text-xs text-slate-800">
                      {runA.dataset.name} ({runA.dataset.nodes.length} node)
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Titik Awal:</span>
                    <span className="text-xs text-slate-700 font-medium">
                      Node {runA.config.startId}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Swap Button A/B */}
            <div className="ab-swap-container">
              <button
                type="button"
                className="ab-swap-btn"
                disabled={!runA || !runB}
                onClick={handleSwapAB}
                title={
                  !runA || !runB
                    ? "Pilih Hasil A dan Hasil B terlebih dahulu untuk menukar"
                    : "Tukar posisi Hasil A dan Hasil B"
                }
              >
                <ArrowRightLeft size={14} />
                <span>Tukar</span>
              </button>
            </div>

            {/* Card Hasil B */}
            <div className="ab-card side-b">
              <div className="ab-card-header">
                <span className={`side-pill ${runB ? "side-b" : "side-b-empty"}`}>
                  {runB ? "Hasil B" : "Hasil B (Kosong)"}
                </span>
                {idB && <span className="run-id-pill">#{idB.shortId}</span>}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 block">
                  Pilih Eksperimen B (Pembanding):
                </span>
                <Select
                  value={runB?.id ?? ""}
                  onChange={handleSelectB}
                  placeholder="Pilih hasil pembanding B..."
                  options={[
                    { value: "", label: "(Belum memilih Hasil B)" },
                    ...runs.map((r) => {
                      const ident = getRunIdentity(r, runs);
                      const isA = r.id === runA?.id;
                      return {
                        value: r.id,
                        label: `${ident.fullLabel} (${formatDistance(r.bestCost)})${isA ? " — [Dipilih sebagai A]" : ""}`,
                        badge: r.config.algorithm,
                        disabled: isA,
                      };
                    }),
                  ]}
                />
              </div>

              {runB ? (
                <div className="ab-meta-grid">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Metode:</span>
                    <strong className="text-xs text-slate-800">{getMethodDisplayName(runB)}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Dataset:</span>
                    <strong className="text-xs text-slate-800">
                      {runB.dataset.name} ({runB.dataset.nodes.length} node)
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Titik Awal:</span>
                    <span className="text-xs text-slate-700 font-medium">
                      Node {runB.config.startId}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                  Belum ada hasil pembanding B yang dipilih. Pilih salah satu hasil dari menu
                  dropdown di atas untuk mengaktifkan perbandingan 2 hasil.
                </div>
              )}
            </div>
          </div>

          {/* 2. Status Kesebandingan Sebelum Hasil */}
          {pairComp && (
            <div className={`comparability-panel variant-${pairComp.badgeVariant}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`comparability-badge ${pairComp.badgeVariant}`}>
                    {pairComp.badgeText}
                  </span>
                  <strong className="text-sm text-slate-800">{pairComp.headline}</strong>
                </div>
                {pairComp.details.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-teal-700 hover:text-teal-800 underline font-medium"
                    onClick={() => setShowConditionDetails((v) => !v)}
                  >
                    {showConditionDetails ? "Sembunyikan rincian" : "Lihat kondisi"}
                  </button>
                )}
              </div>

              {pairComp.cancelledWarning && (
                <div className="p-2 mt-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs font-medium flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                  <span>{pairComp.cancelledWarning}</span>
                </div>
              )}

              {showConditionDetails && pairComp.details.length > 0 && (
                <ul className="comparability-list mt-2 pt-2 border-t border-slate-200/60">
                  {pairComp.details.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 3. Tabel Perbandingan 3 Kolom: Metrik | Hasil A | Hasil B */}
          {runA && (
            <div className="comparison-3col-container">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  Evaluasi Metrik Berdampingan
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!runA || !runB}
                  onClick={() => {
                    if (runA && runB) {
                      exportComparison([runA, runB], "heurilab-perbandingan.csv", {
                        [runA.id]: "A",
                        [runB.id]: "B",
                      });
                    }
                  }}
                  title={
                    !runB
                      ? "Pilih Hasil B terlebih dahulu untuk mengekspor CSV perbandingan pasangan"
                      : "Ekspor CSV perbandingan dua hasil aktif (A & B)"
                  }
                >
                  <Download size={14} />
                  <span>Ekspor CSV</span>
                </Button>
              </div>

              <table className="comparison-3col-table">
                <thead>
                  <tr>
                    <th className="col-metric">Metrik Evaluasi</th>
                    <th className="col-run col-run-a">
                      <div className="col-run-header">
                        <span className="side-pill side-a">Hasil A</span>
                        {idA && (
                          <span className="run-id-pill">
                            #{idA.runNumber} · #{idA.shortId}
                          </span>
                        )}
                      </div>
                      <strong className="block text-sm text-slate-800">
                        {getMethodDisplayName(runA)}
                      </strong>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDetailSource("A");
                            setTab("trace");
                          }}
                          title="Buka Analisis Detail Hasil A"
                        >
                          <Activity size={13} /> Detail
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onSelectRun(runA.id);
                            onBackToPlayground();
                          }}
                          title="Tampilkan Hasil A di Kanvas Playground"
                        >
                          <Eye size={13} /> Kanvas
                        </Button>
                      </div>
                    </th>
                    <th className="col-run col-run-b">
                      {runB && idB ? (
                        <>
                          <div className="col-run-header">
                            <span className="side-pill side-b">Hasil B</span>
                            <span className="run-id-pill">
                              #{idB.runNumber} · #{idB.shortId}
                            </span>
                          </div>
                          <strong className="block text-sm text-slate-800">
                            {getMethodDisplayName(runB)}
                          </strong>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDetailSource("B");
                                setTab("trace");
                              }}
                              title="Buka Analisis Detail Hasil B"
                            >
                              <Activity size={13} /> Detail
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                onSelectRun(runB.id);
                                onBackToPlayground();
                              }}
                              title="Tampilkan Hasil B di Kanvas Playground"
                            >
                              <Eye size={13} /> Kanvas
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="py-2 text-slate-400">
                          <span className="side-pill side-b-empty">Hasil B</span>
                          <span className="block text-xs text-slate-500 mt-1">
                            (Belum memilih pembanding B)
                          </span>
                        </div>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Baris 1: Metode */}
                  <tr>
                    <td className="col-metric">Metode</td>
                    <td>
                      <strong className="text-slate-800">{getMethodDisplayName(runA)}</strong>
                    </td>
                    <td>
                      {runB ? (
                        <strong className="text-slate-800">{getMethodDisplayName(runB)}</strong>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>

                  {/* Baris 2: Kategori */}
                  <tr>
                    <td className="col-metric">Kategori Eksperimen</td>
                    <td>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${getCategoryBadge(runA.category).badgeClass}`}
                      >
                        {getCategoryBadge(runA.category).label}
                      </span>
                    </td>
                    <td>
                      {runB ? (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${getCategoryBadge(runB.category).badgeClass}`}
                        >
                          {getCategoryBadge(runB.category).label}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>

                  {/* Baris 2: Dataset */}
                  <tr>
                    <td className="col-metric">Dataset Uji</td>
                    <td>
                      <strong>{runA.dataset.name}</strong>
                      <span className="text-xs text-slate-500 block">
                        {runA.dataset.nodes.length} node · {runA.dataset.unit}
                      </span>
                    </td>
                    <td>
                      {runB ? (
                        <>
                          <strong>{runB.dataset.name}</strong>
                          <span className="text-xs text-slate-500 block">
                            {runB.dataset.nodes.length} node · {runB.dataset.unit}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>

                  {/* Baris 3: Titik Awal */}
                  <tr>
                    <td className="col-metric">Titik Awal (Start Node)</td>
                    <td>
                      <span className="font-semibold text-slate-800">
                        Node {runA.config.startId}
                      </span>
                    </td>
                    <td>
                      {runB ? (
                        <span className="font-semibold text-slate-800">
                          Node {runB.config.startId}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>

                  {/* Baris 4: Jarak Awal */}
                  <tr>
                    <td className="col-metric">Jarak Solusi Awal</td>
                    <td>
                      {runA.category === "construction" ? (
                        <span className="text-slate-400 font-mono">— (Baseline Konstruksi)</span>
                      ) : (
                        <span className="font-tabular text-slate-700">
                          {formatDistance(runA.initialCost)} {runA.dataset.unit}
                        </span>
                      )}
                    </td>
                    <td>
                      {runB ? (
                        runB.category === "construction" ? (
                          <span className="text-slate-400 font-mono">— (Baseline Konstruksi)</span>
                        ) : (
                          <span className="font-tabular text-slate-700">
                            {formatDistance(runB.initialCost)} {runB.dataset.unit}
                          </span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>

                  {/* Baris 5: Jarak Akhir Terbaik */}
                  <tr>
                    <td className="col-metric">Jarak Hasil / Terbaik</td>
                    <td>
                      <strong className="text-teal-700 font-tabular font-bold text-sm">
                        {formatDistance(runA.bestCost)} {runA.dataset.unit}
                      </strong>
                    </td>
                    <td>
                      {runB ? (
                        <strong className="text-amber-700 font-tabular font-bold text-sm">
                          {formatDistance(runB.bestCost)} {runB.dataset.unit}
                        </strong>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>

                  {/* Baris 6: Persentase Perbaikan */}
                  <tr>
                    <td className="col-metric">Perbaikan Terhadap Awal</td>
                    <td>
                      {runA.category === "construction" ? (
                        <span className="text-slate-400 font-mono">—</span>
                      ) : Math.abs(runA.initialCost - runA.bestCost) <= EPSILON ? (
                        <span className="text-slate-500 font-medium">0,00% (Tetap)</span>
                      ) : (
                        <span className="text-teal-700 font-semibold font-tabular">
                          {formatPercent(
                            ((runA.initialCost - runA.bestCost) / runA.initialCost) * 100,
                          )}
                        </span>
                      )}
                    </td>
                    <td>
                      {runB ? (
                        runB.category === "construction" ? (
                          <span className="text-slate-400 font-mono">—</span>
                        ) : Math.abs(runB.initialCost - runB.bestCost) <= EPSILON ? (
                          <span className="text-slate-500 font-medium">0,00% (Tetap)</span>
                        ) : (
                          <span className="text-amber-700 font-semibold font-tabular">
                            {formatPercent(
                              ((runB.initialCost - runB.bestCost) / runB.initialCost) * 100,
                            )}
                          </span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>

                  {/* Baris 7: Iterasi / Langkah Aktual */}
                  <tr>
                    <td className="col-metric">Iterasi / Langkah Aktual</td>
                    <td>
                      {runA.category === "construction" ? (
                        <span className="text-slate-500 text-xs">1 lintasan deterministik</span>
                      ) : runA.category === "local-search" ? (
                        <span>{runA.iterations} langkah descent</span>
                      ) : (
                        <span>{runA.iterations.toLocaleString("id-ID")} iterasi</span>
                      )}
                    </td>
                    <td>
                      {runB ? (
                        runB.category === "construction" ? (
                          <span className="text-slate-500 text-xs">1 lintasan deterministik</span>
                        ) : runB.category === "local-search" ? (
                          <span>{runB.iterations} langkah descent</span>
                        ) : (
                          <span>{runB.iterations.toLocaleString("id-ID")} iterasi</span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>

                  {/* Baris 8: Evaluasi Kandidat */}
                  <tr>
                    <td className="col-metric">Evaluasi Kandidat</td>
                    <td>
                      <span className="font-tabular">
                        {runA.evaluations.toLocaleString("id-ID")} kandidat
                      </span>
                    </td>
                    <td>
                      {runB ? (
                        <span className="font-tabular">
                          {runB.evaluations.toLocaleString("id-ID")} kandidat
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>

                  {/* Baris 9: Batas Iterasi Maksimum */}
                  <tr>
                    <td className="col-metric">Batas Iterasi Maksimum</td>
                    <td>
                      {runA.category === "metaheuristic" ? (
                        <span className="font-tabular">
                          {runA.config.maxIterations.toLocaleString("id-ID")} iterasi
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                    <td>
                      {runB ? (
                        runB.category === "metaheuristic" ? (
                          <span className="font-tabular">
                            {runB.config.maxIterations.toLocaleString("id-ID")} iterasi
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>

                  {/* Baris 10: Waktu Pencarian Murni */}
                  <tr>
                    <td className="col-metric">Waktu Pencarian (Search Time)</td>
                    <td>
                      <span className="font-tabular font-medium text-slate-800">
                        {formatDuration(
                          runA.durations?.searchMs ??
                            (runA.category === "construction"
                              ? runA.durations?.constructionMs
                              : runA.durations
                                ? undefined
                                : runA.durationMs),
                        )}
                      </span>
                    </td>
                    <td>
                      {runB ? (
                        <span className="font-tabular font-medium text-slate-800">
                          {formatDuration(
                            runB.durations?.searchMs ??
                              (runB.category === "construction"
                                ? runB.durations?.constructionMs
                                : runB.durations
                                  ? undefined
                                  : runB.durationMs),
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>

                  {/* Baris 11: Total Waktu Pipeline Terukur */}
                  <tr>
                    <td className="col-metric">Total Waktu Komputasi Terukur</td>
                    <td>
                      <span className="font-tabular text-slate-700">
                        {runA.durations?.totalMs !== undefined
                          ? formatDuration(runA.durations.totalMs)
                          : "— (data legacy tanpa breakdown)"}
                      </span>
                      {runA.durations && (
                        <small className="block text-[10px] text-slate-500 font-tabular mt-0.5">
                          {formatStageBreakdown(runA).summary}
                        </small>
                      )}
                    </td>
                    <td>
                      {runB ? (
                        <>
                          <span className="font-tabular text-slate-700">
                            {runB.durations?.totalMs !== undefined
                              ? formatDuration(runB.durations.totalMs)
                              : "— (data legacy tanpa breakdown)"}
                          </span>
                          {runB.durations && (
                            <small className="block text-[10px] text-slate-500 font-tabular mt-0.5">
                              {formatStageBreakdown(runB).summary}
                            </small>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>

                  {/* Baris 12: Status Eksekusi */}
                  <tr>
                    <td className="col-metric">Status & Alasan Berhenti</td>
                    <td>
                      <span className="font-medium text-slate-800">
                        {runA.status === "completed" ? "Selesai" : "Dibatalkan"}:
                      </span>{" "}
                      <span className="text-xs text-slate-600">
                        {stopLabels[runA.stopReason] ?? runA.stopReason}
                      </span>
                    </td>
                    <td>
                      {runB ? (
                        <>
                          <span className="font-medium text-slate-800">
                            {runB.status === "completed" ? "Selesai" : "Dibatalkan"}:
                          </span>{" "}
                          <span className="text-xs text-slate-600">
                            {stopLabels[runB.stopReason] ?? runB.stopReason}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 4. Kartu Ringkasan Pasangan (Pair Summary Card) */}
          {runA && runB && (
            <div className="pair-summary-card">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Ringkasan Pasangan Uji
              </h4>

              {!pairComp || !pairComp.isComparable ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm">
                  <strong>Kondisi berbeda — hasil ditampilkan untuk ditinjau:</strong>{" "}
                  {pairComp?.headline ?? "Kondisi pengujian tidak sebanding"}. Metrik jarak dan
                  durasi ditampilkan berdampingan pada tabel di atas untuk evaluasi masing-masing
                  run, tanpa penetapan keunggulan otomatis.
                </div>
              ) : Math.abs(runA.bestCost - runB.bestCost) <= EPSILON ? (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 text-sm">
                  <strong>Jarak setara dalam toleransi numerik pada pasangan ini:</strong> Kedua
                  metode menghasilkan rute dengan panjang yang setara (
                  <span className="font-tabular font-bold">{formatDistance(runA.bestCost)}</span>{" "}
                  {runA.dataset.unit}).
                </div>
              ) : runA.bestCost < runB.bestCost ? (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 text-sm">
                  <strong>
                    Hasil A ({getMethodDisplayName(runA)}) menghasilkan jarak lebih pendek:
                  </strong>{" "}
                  Tur Hasil A lebih hemat{" "}
                  <span className="font-tabular font-bold">
                    {formatPercent(((runB.bestCost - runA.bestCost) / (runB.bestCost || 1)) * 100)}
                  </span>{" "}
                  (selisih{" "}
                  <span className="font-tabular font-bold">
                    {formatDistance(runB.bestCost - runA.bestCost)}
                  </span>{" "}
                  {runA.dataset.unit}) dibanding Hasil B pada percobaan ini.
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
                  <strong>
                    Hasil B ({getMethodDisplayName(runB)}) menghasilkan jarak lebih pendek:
                  </strong>{" "}
                  Tur Hasil B lebih hemat{" "}
                  <span className="font-tabular font-bold">
                    {formatPercent(((runA.bestCost - runB.bestCost) / (runA.bestCost || 1)) * 100)}
                  </span>{" "}
                  (selisih{" "}
                  <span className="font-tabular font-bold">
                    {formatDistance(runA.bestCost - runB.bestCost)}
                  </span>{" "}
                  {runA.dataset.unit}) dibanding Hasil A pada percobaan ini.
                </div>
              )}

              {/* Catatan waktu komparatif */}
              {pairComp?.isComparable &&
                runA.durations?.searchMs !== undefined &&
                runB.durations?.searchMs !== undefined && (
                  <p className="text-xs text-slate-600 mt-2">
                    <strong>Komparasi Waktu Pencarian (searchMs):</strong> Hasil A menyelesaikan
                    tahap pencarian dalam {formatDuration(runA.durations.searchMs)}, sedangkan Hasil
                    B membutuhkan {formatDuration(runB.durations.searchMs)}.
                  </p>
                )}

              {/* Catatan Ilmiah Netral & Spesifik */}
              <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
                <em>Catatan Ilmiah:</em> Hasil perbandingan ini berlaku spesifik pada dataset,
                konfigurasi parameter, dan seed pengujian ini. Tabu Search pada implementasi ini
                bersifat deterministik untuk input dan konfigurasi yang sama, sedangkan Simulated
                Annealing menggunakan generator angka acak semu (PRNG) berbasis seed sehingga dapat
                direproduksi. Keduanya merupakan metode metaheuristik yang tidak menjamin
                tercapainya optimum global untuk dataset umum; hasil satu percobaan tidak
                membuktikan keunggulan mutlak suatu metode atas metode lain secara umum.
              </p>
            </div>
          )}

          {/* 5. Bagian Parameter Eksperimen & Urutan Rute Lengkap */}
          {runA && (
            <details className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <summary className="cursor-pointer font-bold text-xs text-slate-700 uppercase tracking-wide flex items-center justify-between">
                <span>Parameter Eksperimen & Urutan Rute Lengkap</span>
                <span className="text-xs text-slate-400 font-normal">Klik untuk melihat</span>
              </summary>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200">
                {/* Kolom Hasil A */}
                <div className="space-y-2 text-xs">
                  <span className="side-pill side-a font-bold">
                    Hasil A: {getMethodDisplayName(runA)}
                  </span>
                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                    <div>
                      <strong>Konfigurasi:</strong>
                    </div>
                    {runA.category === "metaheuristic" ? (
                      <div>
                        {runA.config.algorithm === "TS" ? (
                          <span>Tabu tenure: {runA.config.tenure} · Aspiration aktif</span>
                        ) : (
                          <span>
                            T₀={runA.config.initialTemperature}, α={runA.config.coolingRate}, Seed=
                            {runA.config.seed}, Tmin={runA.config.minimumTemperature ?? 0.001}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div>Metode awal: {runA.config.initialMethod}</div>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">
                      Rute Kunjungan Terbaik Akhir:
                    </span>
                    <div className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200 overflow-x-auto whitespace-nowrap">
                      {closedRoute(runA.bestRoute, runA.dataset).join(" → ")}
                    </div>
                  </div>
                </div>

                {/* Kolom Hasil B */}
                <div className="space-y-2 text-xs">
                  {runB ? (
                    <>
                      <span className="side-pill side-b font-bold">
                        Hasil B: {getMethodDisplayName(runB)}
                      </span>
                      <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                        <div>
                          <strong>Konfigurasi:</strong>
                        </div>
                        {runB.category === "metaheuristic" ? (
                          <div>
                            {runB.config.algorithm === "TS" ? (
                              <span>Tabu tenure: {runB.config.tenure} · Aspiration aktif</span>
                            ) : (
                              <span>
                                T₀={runB.config.initialTemperature}, α={runB.config.coolingRate},
                                Seed={runB.config.seed}, Tmin=
                                {runB.config.minimumTemperature ?? 0.001}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>Metode awal: {runB.config.initialMethod}</div>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">
                          Rute Kunjungan Terbaik Akhir:
                        </span>
                        <div className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200 overflow-x-auto whitespace-nowrap">
                          {closedRoute(runB.bestRoute, runB.dataset).join(" → ")}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-400 italic py-4">
                      Hasil B belum dipilih. Parameter Hasil B akan tampil di sini setelah dipilih.
                    </div>
                  )}
                </div>
              </div>
            </details>
          )}

          {/* 6. Bagian Riwayat Pendukung: Semua Hasil Eksperimen */}
          <details
            className="mt-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
            open={showAllHistory}
            onToggle={(e) => setShowAllHistory((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer font-bold text-sm text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>Semua hasil eksperimen</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {runs.length} hasil
                </span>
              </span>
              <span className="text-xs text-slate-500 font-normal">
                {showAllHistory
                  ? "Tutup daftar riwayat"
                  : "Klik untuk membuka seluruh riwayat sesi"}
              </span>
            </summary>

            <div className="table-scroll mt-3">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Metode & Kategori</th>
                    <th>Dataset</th>
                    <th>Jarak Akhir</th>
                    <th>Perbaikan</th>
                    <th>Durasi Total</th>
                    <th>Aksi Eksplisit</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((item, idx) => {
                    const isRunA = item.id === runA?.id;
                    const isRunB = item.id === runB?.id;
                    const catInfo = getCategoryBadge(item.category);
                    const isConstruction = item.category === "construction";
                    const isNoChange =
                      !isConstruction && Math.abs(item.initialCost - item.bestCost) <= EPSILON;
                    const isImproved =
                      !isConstruction && item.initialCost > item.bestCost + EPSILON;
                    const rawImpr = isConstruction
                      ? null
                      : item.initialCost === 0
                        ? 0
                        : ((item.initialCost - item.bestCost) / item.initialCost) * 100;

                    return (
                      <tr
                        key={item.id}
                        className={`${isRunA ? "bg-teal-50/40" : isRunB ? "bg-amber-50/40" : ""}`}
                      >
                        <td>
                          <span className="text-xs font-bold text-slate-600">
                            #{runs.length - idx}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${catInfo.badgeClass}`}
                            >
                              {catInfo.label}
                            </span>
                            {isRunA && <span className="side-pill side-a">A</span>}
                            {isRunB && <span className="side-pill side-b">B</span>}
                          </div>
                          <strong className="text-xs block text-slate-800">
                            {getMethodDisplayName(item)}
                          </strong>
                        </td>
                        <td>
                          <span className="text-xs font-medium">{item.dataset.name}</span>
                          <small className="block text-[11px] text-slate-500">
                            {item.dataset.nodes.length} node
                          </small>
                        </td>
                        <td>
                          <strong className="best-cell font-tabular text-xs">
                            {formatDistance(item.bestCost)}
                          </strong>
                        </td>
                        <td>
                          {isConstruction ? (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          ) : isNoChange ? (
                            <span className="text-xs text-slate-500">0,00%</span>
                          ) : isImproved ? (
                            <span className="improvement-badge text-xs">
                              <TrendingDown size={11} /> {formatPercent(rawImpr!)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          )}
                        </td>
                        <td>
                          <span className="font-tabular text-xs text-slate-700">
                            {formatDuration(item.durations?.totalMs ?? item.durationMs)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant={isRunA ? "primary" : "outline"}
                              disabled={isRunA}
                              onClick={() => handleSelectA(item.id)}
                              title="Jadikan sebagai Hasil A untuk perbandingan"
                            >
                              Pilih sbg A
                            </Button>
                            <Button
                              size="sm"
                              variant={isRunB ? "secondary" : "outline"}
                              disabled={isRunB}
                              onClick={() => handleSelectB(item.id)}
                              title="Jadikan sebagai Hasil B untuk perbandingan"
                            >
                              Pilih sbg B
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRunAId(item.id);
                                setDetailSource("A");
                                setTab("trace");
                              }}
                              title="Lihat detail lengkap run ini"
                            >
                              <Activity size={13} /> Detail
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                onSelectRun(item.id);
                                onBackToPlayground();
                              }}
                              title="Tampilkan di kanvas playground"
                            >
                              <Eye size={13} /> Kanvas
                            </Button>
                            <button
                              type="button"
                              className="delete-run-icon-btn"
                              aria-label={`Hapus Run #${runs.length - idx}`}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Apakah Anda yakin ingin menghapus Run #${runs.length - idx}?`,
                                  )
                                ) {
                                  onRemoveRun(item.id);
                                }
                              }}
                              title="Hapus run ini dari riwayat"
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
          </details>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DETAIL & TRACE REPLAY VIEW
          ========================================================================= */}
      {tab === "trace" && detailRun && (
        <div className="space-y-4">
          {/* Sub-selector Detail Hasil A vs Hasil B */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            {runA && (
              <button
                type="button"
                className={`detail-source-toggle-btn ${detailSource === "A" ? "active" : ""}`}
                onClick={() => setDetailSource("A")}
              >
                <span className="font-bold mr-1">Detail Hasil A:</span>
                <span>{getMethodDisplayName(runA)}</span>
                <span className="font-tabular ml-1.5 opacity-80">
                  ({formatDistance(runA.bestCost)})
                </span>
              </button>
            )}

            <button
              type="button"
              className={`detail-source-toggle-btn ${detailSource === "B" ? "active" : ""}`}
              onClick={() => setDetailSource("B")}
              disabled={!runB}
              title={
                !runB ? "Pilih Hasil B di tab Perbandingan untuk melihat detailnya" : undefined
              }
            >
              <span className="font-bold mr-1">Detail Hasil B:</span>
              <span>{runB ? getMethodDisplayName(runB) : "(Hasil B Belum Dipilih)"}</span>
              {runB && (
                <span className="font-tabular ml-1.5 opacity-80">
                  ({formatDistance(runB.bestCost)})
                </span>
              )}
            </button>
          </div>

          {/* Construction Run Detail */}
          {detailRun.category === "construction" && (
            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">DETAIL HASIL {detailSource} · METODE KONSTRUKSI</span>
                  <h3 className="flex items-center gap-2">
                    <span>{getMethodDisplayName(detailRun)}</span>
                    <span className="text-sm font-normal text-slate-500">
                      · {detailRun.dataset.name}
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => exportRun(detailRun)}>
                    <Download size={14} /> Ekspor JSON
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      onSelectRun(detailRun.id);
                      onBackToPlayground();
                    }}
                  >
                    <Eye size={14} /> Tampilkan Hasil {detailSource} di Kanvas
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
                <div className="metric-cell primary">
                  <span className="metric-label">Jarak Total Rute</span>
                  <strong className="metric-value font-tabular">
                    {formatDistance(detailRun.bestCost)}
                  </strong>
                  <small className="metric-sub">{detailRun.dataset.unit}</small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Titik Awal (Start Node)</span>
                  <strong className="metric-value">Node {detailRun.config.startId}</strong>
                  <small className="metric-sub">{detailRun.config.initialMethod}</small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Ukuran Rute</span>
                  <strong className="metric-value">{detailRun.bestRoute.length} titik</strong>
                  <small className="metric-sub">Siklus tertutup</small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Waktu Konstruksi</span>
                  <strong className="metric-value font-tabular">
                    {formatDuration(detailRun.durations?.constructionMs ?? detailRun.durationMs)}
                  </strong>
                  <small className="metric-sub">
                    {stopLabels[detailRun.stopReason] ?? detailRun.stopReason}
                  </small>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mt-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Urutan Kunjungan Node
                </h4>
                <div className="font-mono text-xs text-slate-800 bg-white p-3 rounded-lg border border-slate-200 overflow-x-auto whitespace-nowrap">
                  {closedRoute(detailRun.bestRoute, detailRun.dataset).join(" → ")}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Metode konstruksi membentuk rute lengkap secara deterministik langsung dari
                  himpunan titik tanpa iterasi pertukaran (move).
                </p>
              </div>
            </div>
          )}

          {/* Local Search Run Detail */}
          {detailRun.category === "local-search" && (
            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    DETAIL HASIL {detailSource} · LOCAL SEARCH DESCENT
                  </span>
                  <h3 className="flex items-center gap-2">
                    <span>{getMethodDisplayName(detailRun)}</span>
                    <span className="text-sm font-normal text-slate-500">
                      · {detailRun.dataset.name}
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => exportRun(detailRun)}>
                    <Download size={14} /> Ekspor JSON
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      onSelectRun(detailRun.id);
                      onBackToPlayground();
                    }}
                  >
                    <Eye size={14} /> Tampilkan Hasil {detailSource} di Kanvas
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
                <div className="metric-cell primary">
                  <span className="metric-label">Jarak Akhir Terbaik</span>
                  <strong className="metric-value font-tabular">
                    {formatDistance(detailRun.bestCost)}
                  </strong>
                  <small className="metric-sub">{detailRun.dataset.unit}</small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Jarak Solusi Awal</span>
                  <strong className="metric-value font-tabular">
                    {formatDistance(detailRun.initialCost)}
                  </strong>
                  <small className="metric-sub">{detailRun.config.initialMethod}</small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Total Langkah Perbaikan</span>
                  <strong className="metric-value">{detailRun.iterations} langkah</strong>
                  <small className="metric-sub">
                    {detailRun.evaluations.toLocaleString("id-ID")} kandidat dievaluasi
                  </small>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">Durasi Komputasi</span>
                  <strong className="metric-value font-tabular">
                    {formatDuration(detailRun.durations?.totalMs ?? detailRun.durationMs)}
                  </strong>
                  <small className="metric-sub">
                    {stopLabels[detailRun.stopReason] ?? detailRun.stopReason}
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
                    {(detailRun.initialCost === 0
                      ? 0
                      : ((detailRun.initialCost - detailRun.bestCost) / detailRun.initialCost) * 100
                    ).toFixed(2)}
                    %
                  </span>
                </div>
                <div className="text-xs space-y-1.5 text-slate-700">
                  <div>
                    <span className="text-slate-500">
                      Rute Dasar ({detailRun.config.initialMethod}):{" "}
                    </span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      {closedRoute(detailRun.initialRoute, detailRun.dataset).join(" → ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Rute Hasil Perbaikan: </span>
                    <span className="font-mono bg-teal-50 text-teal-900 px-2 py-0.5 rounded border border-teal-200">
                      {closedRoute(detailRun.bestRoute, detailRun.dataset).join(" → ")}
                    </span>
                  </div>
                </div>
              </div>

              {detailRun.trace.length > 0 && (
                <div className="mt-4">
                  <CostConvergenceChart run={detailRun} compareRun={null} />
                  <TraceReplayViewer
                    run={detailRun}
                    selectedStep={selectedStep}
                    onSelectStep={setSelectedStep}
                  />
                  <TraceTableComponent
                    key={detailRun.id}
                    run={detailRun}
                    selected={selectedStep}
                    onSelect={setSelectedStep}
                  />
                  {selectedStep >= 0 && detailRun.trace[selectedStep] && (
                    <TraceDetailsComponent
                      step={detailRun.trace[selectedStep]!}
                      dataset={detailRun.dataset}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Metaheuristic Run Detail */}
          {detailRun.category === "metaheuristic" && (
            <>
              <div className="panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      DETAIL HASIL {detailSource} ·{" "}
                      {detailRun.config.algorithm === "TS" ? "TABU SEARCH" : "SIMULATED ANNEALING"}
                    </span>
                    <h3 className="flex items-center gap-2">
                      <span>{getMethodDisplayName(detailRun)}</span>
                      <span className="text-sm font-normal text-slate-500">
                        · {detailRun.dataset.name}
                      </span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => exportRun(detailRun)}>
                      <Download size={14} /> Ekspor JSON
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        onSelectRun(detailRun.id);
                        onBackToPlayground();
                      }}
                    >
                      <Eye size={14} /> Tampilkan Hasil {detailSource} di Kanvas
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600 my-2 flex-wrap">
                  <span>
                    <strong>Batas Iterasi:</strong> {detailRun.config.maxIterations}
                  </span>
                  {detailRun.config.algorithm === "TS" ? (
                    <span>
                      <strong>Tabu Tenure:</strong> {detailRun.config.tenure} · Aspiration aktif
                    </span>
                  ) : (
                    <span>
                      <strong>SA Params:</strong> T₀={detailRun.config.initialTemperature}, α=
                      {detailRun.config.coolingRate}, Seed={detailRun.config.seed}, Tmin=
                      {detailRun.config.minimumTemperature ?? 0.001}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
                  <div className="metric-cell primary">
                    <span className="metric-label">Jarak Akhir Terbaik</span>
                    <strong className="metric-value font-tabular">
                      {formatDistance(detailRun.bestCost)}
                    </strong>
                    <small className="metric-sub">{detailRun.dataset.unit}</small>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-label">Jarak Solusi Awal</span>
                    <strong className="metric-value font-tabular">
                      {formatDistance(detailRun.initialCost)}
                    </strong>
                    <small className="metric-sub">{detailRun.config.initialMethod}</small>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-label">Total Evaluasi</span>
                    <strong className="metric-value">
                      {detailRun.evaluations.toLocaleString("id-ID")}
                    </strong>
                    <small className="metric-sub">{detailRun.iterations} iterasi</small>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-label">Durasi Komputasi</span>
                    <strong className="metric-value font-tabular">
                      {formatDuration(detailRun.durations?.totalMs ?? detailRun.durationMs)}
                    </strong>
                    <small className="metric-sub">
                      {stopLabels[detailRun.stopReason] ?? detailRun.stopReason}
                    </small>
                  </div>
                </div>

                {/* Route Tour Details */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 my-3">
                  <div>
                    <span className="text-slate-500 font-medium">Rute Solusi Awal: </span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      {closedRoute(detailRun.initialRoute, detailRun.dataset).join(" → ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-teal-700 font-medium">Rute Terbaik Akhir: </span>
                    <span className="font-mono bg-teal-50 text-teal-900 px-2 py-0.5 rounded border border-teal-200">
                      {closedRoute(detailRun.bestRoute, detailRun.dataset).join(" → ")}
                    </span>
                  </div>
                </div>

                {/* Convergence Chart comparing A and B directly */}
                {runA && (
                  <div className="mt-4">
                    <CostConvergenceChart
                      run={detailRun}
                      compareRun={
                        detailSource === "A" && runB
                          ? runB
                          : detailSource === "B" && runA
                            ? runA
                            : null
                      }
                    />
                  </div>
                )}
              </div>

              {/* Trace Replay Panel */}
              <div className="panel">
                <TraceReplayViewer
                  run={detailRun}
                  selectedStep={selectedStep}
                  onSelectStep={setSelectedStep}
                />
                <TraceTableComponent
                  key={detailRun.id}
                  run={detailRun}
                  selected={selectedStep}
                  onSelect={setSelectedStep}
                />
                {selectedStep >= 0 && detailRun.trace[selectedStep] && (
                  <TraceDetailsComponent
                    step={detailRun.trace[selectedStep]!}
                    dataset={detailRun.dataset}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* =========================================================================
      {/* =========================================================================
          TAB 3: MATRIKS JARAK ANTAR NODE (DENGAN SUMBER FLEKSIBEL)
          ========================================================================= */}
      {tab === "matrix" && (
        <div className="panel report-panel distance-matrix-panel">
          <div className="section-heading mb-3">
            <div>
              <h3 className="section-title">Matriks jarak</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Matriks simetris jarak Euclidean planar antar setiap pasangan simpul (node) pada
                dataset.
              </p>
            </div>
          </div>

          {/* 2. Field Sumber matriks dan metadata */}
          <div className="matrix-source-control-group mb-3">
            <span className="text-xs font-semibold text-slate-700 block mb-1">Sumber matriks:</span>
            <Select
              value={matrixSource}
              onChange={(val) => setMatrixSource(val as "A" | "B" | "canvas")}
              options={matrixSourceOptions}
            />

            {activeMatrixDataset && (
              <div className="matrix-source-metadata">
                <div>
                  <span className="text-slate-400 mr-1">Dataset:</span>
                  <strong className="text-slate-800">{activeMatrixDataset.name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 mr-1">Jumlah:</span>
                  <strong className="text-slate-800 font-tabular">
                    {activeMatrixDataset.nodes.length} node
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 mr-1">Sifat data:</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200/70 text-slate-700">
                    {activeSourceType === "snapshot" ? "Snapshot tersimpan" : "Data kerja aktif"}
                  </span>
                </div>
                <div className="w-full text-[11px] text-slate-500 mt-0.5">{activeSourceDetail}</div>
              </div>
            )}

            {!runB && (
              <p className="text-[11px] text-slate-400 mt-1">
                Hasil B belum dipilih di tab Perbandingan, sehingga belum tersedia sebagai pilihan
                sumber.
              </p>
            )}
          </div>

          {/* 3. Pesan kesamaan A/B hanya jika telah diverifikasi isDatasetIdentical */}
          {runA && runB && isDatasetIdentical(runA.dataset, runB.dataset) && (
            <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-teal-800 text-xs mb-3 flex items-center gap-2">
              <Info size={14} className="text-teal-600 shrink-0" />
              <span>
                Dataset pada Hasil A dan Hasil B terverifikasi identik ({runA.dataset.nodes.length}{" "}
                node, koordinat sama). Matriks jarak kedua hasil bernilai sama.
              </span>
            </div>
          )}

          {/* 4. Ringkasan Model Jarak */}
          <div className="matrix-model-summary">
            <span className="font-semibold text-slate-700">Model jarak:</span> Euclidean planar
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-slate-700">Satuan:</span> unit koordinat (
            {activeMatrixDataset?.unit ?? "unit"})
          </div>

          {/* 5 & 6. Matriks dalam wadah scroll sendiri dan Panel Formula */}
          {activeMatrixDataset ? (
            <InteractiveMatrixComponent
              dataset={activeMatrixDataset}
              sourceLabel={activeSourceTitle}
            />
          ) : (
            <div className="p-6 text-center text-slate-400 italic bg-slate-50 rounded-lg border border-slate-200">
              Sumber matriks yang dipilih tidak tersedia atau telah dihapus. Silakan pilih sumber
              matriks lain.
            </div>
          )}
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

        {/* Secondary Comparison Run */}
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
        <text x="640" y="114" fontSize="10">
          Max {maxIters}
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
      {/* Mode Bar */}
      <div className="replay-mode-bar">
        <div className="flex items-center gap-2">
          {isReplaying ? (
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              Mode: Telusuri Iterasi (Langkah #{activeIndex + 1})
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
              Mode: Rute Hasil Akhir
            </span>
          )}
          <span className="text-xs text-slate-500 font-tabular">
            Jarak: {formatDistance(isReplaying ? step.bestCost : run.bestCost)} {run.dataset.unit}
          </span>
        </div>

        <div>
          {!isReplaying ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onSelectStep(0)}
              title="Mulai telusuri keputusan tiap iterasi dari langkah 0"
            >
              <Activity size={13} /> Telusuri Iterasi (Langkah 0)
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSelectStep(-1)}
              title="Kembali ke tampilan rute hasil akhir"
            >
              <RotateCcw size={13} /> Kembali ke hasil akhir
            </Button>
          )}
        </div>
      </div>

      {/* Replay Controls (Hanya aktif dalam mode telusuri iterasi) */}
      {isReplaying && (
        <>
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
        </>
      )}

      {/* Replay Visualization & Details */}
      <div className="replay-content-grid">
        <div className="replay-canvas-wrapper">
          <svg
            viewBox="0 0 600 280"
            className="replay-svg"
            role="img"
            aria-label="Visualisasi rute interaktif"
          >
            {/* Background Canvas Bounds */}
            <rect
              x="5"
              y="5"
              width="590"
              height="270"
              rx="10"
              fill="#fafbf8"
              stroke="#e2e8f0"
              strokeWidth="1"
            />

            {/* Layer 1: Initial Route (Baseline) */}
            {run.initialRoute.length > 2 && (
              <path
                d={getPathD(run.initialRoute)}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="1.6"
                strokeDasharray="4 4"
                opacity="0.8"
              />
            )}

            {/* Layer 2: Current Route (Hanya tampil saat replay) */}
            {isReplaying && current.length > 2 && (
              <path
                d={getPathD(current)}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="2.2"
                strokeDasharray="6 4"
                opacity="0.9"
              />
            )}

            {/* Layer 3: Candidate Route (Hanya tampil saat replay) */}
            {isReplaying && candidate && candidate.length > 2 && (
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

            {/* Layer 5: Node Points & Labels */}
            {nodes.map((node) => {
              const p = project(node.x, node.y);
              const isStart = node.id === run.config.startId;
              return (
                <g key={node.id} transform={`translate(${p.x}, ${p.y})`}>
                  <circle
                    r={isStart ? 7 : 5}
                    fill={isStart ? "#dc2626" : "#0d9488"}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x={0}
                    y={-10}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#1e293b"
                    className="select-none"
                  >
                    {node.id}
                  </text>
                  {isStart && (
                    <text
                      x={0}
                      y={16}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="600"
                      fill="#dc2626"
                    >
                      Start
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Color Legend */}
          <div className="replay-legend">
            <span className="legend-item">
              <span className="legend-line initial" /> Rute Awal
            </span>
            {isReplaying && (
              <>
                <span className="legend-item">
                  <span className="legend-line current" /> Current (Biru)
                </span>
                <span className="legend-item">
                  <span className="legend-line candidate" /> Kandidat (Oranye)
                </span>
              </>
            )}
            <span className="legend-item">
              <span className="legend-line best" /> Best-so-far (Teal)
            </span>
          </div>
        </div>

        {/* Replay Decision Panel */}
        <div className="replay-info-panel">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <h5 className="font-bold text-slate-700 uppercase tracking-wide">
              {isReplaying ? `Evaluasi Iterasi #${step.iteration}` : "Ringkasan Hasil Akhir"}
            </h5>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Jarak Best-so-far:</span>
                <strong className="text-teal-700 font-tabular">
                  {formatDistance(isReplaying ? step.bestCost : run.bestCost)}
                </strong>
              </div>

              {isReplaying ? (
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Jarak Kandidat:</span>
                  <strong className="text-amber-700 font-tabular">
                    {formatDistance(step.candidateCost)}
                  </strong>
                </div>
              ) : (
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Rute Awal:</span>
                  <strong className="text-slate-600 font-tabular">
                    {formatDistance(run.initialCost)}
                  </strong>
                </div>
              )}

              {isReplaying && (
                <>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Jarak Current:</span>
                    <strong className="text-sky-700 font-tabular">
                      {formatDistance(step.currentCost)}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">
                      Delta Biaya (Δ = d_cand - d_curr):
                    </span>
                    <strong
                      className={`font-tabular ${
                        step.candidateCost - step.currentCost < 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {step.candidateCost - step.currentCost > 0 ? "+" : ""}
                      {formatDistance(step.candidateCost - step.currentCost)}
                    </strong>
                  </div>
                </>
              )}
            </div>

            {isReplaying && (
              <div className="p-2 bg-white rounded border border-slate-200 space-y-1">
                <div>
                  <span className="text-slate-500">Status Keputusan: </span>
                  <strong
                    className={isAccepted || isAspiration ? "text-emerald-700" : "text-rose-700"}
                  >
                    {isAspiration
                      ? "Diterima via Aspiration (Mengalahkan Best)"
                      : isAccepted
                        ? "Diterima (Solusi Lebih Baik atau Lolos Uji Probabilitas)"
                        : "Ditolak"}
                  </strong>
                </div>

                {run.config.algorithm === "TS" && (
                  <div>
                    <span className="text-slate-500">Status Tabu Move: </span>
                    <span>
                      {isTabu ? (
                        <span className="text-amber-700 font-semibold">
                          Masuk Tabu List (Tenure: {run.config.tenure})
                        </span>
                      ) : (
                        "Bukan Tabu (Move Eligible)"
                      )}
                    </span>
                  </div>
                )}

                {run.config.algorithm === "SA" && step.temperature !== undefined && (
                  <div>
                    <span className="text-slate-500">Suhu Saat Ini (T): </span>
                    <span className="font-tabular font-mono text-slate-800">
                      {step.temperature.toFixed(4)}
                    </span>
                    {step.probability !== undefined && (
                      <span className="ml-2 text-slate-500">
                        (P = {(step.probability * 100).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                )}
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

  const start = safePage * pageSize;
  const rows = run.trace.slice(start, start + pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="small muted">
          Menampilkan baris {start + 1}–{Math.min(run.trace.length, start + pageSize)} dari{" "}
          {run.trace.length} langkah
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </Button>
          <span className="small muted">
            {safePage + 1} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="trace-table">
          <thead>
            <tr>
              <th>Iterasi</th>
              <th>Current</th>
              <th>Kandidat</th>
              <th>Best</th>
              <th>Delta</th>
              <th>Status</th>
              <th>Alasan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((step, idx) => {
              const actualIndex = start + idx;
              const isSelected = selected === actualIndex;
              const delta = step.candidateCost - step.currentCost;
              return (
                <tr
                  key={actualIndex}
                  className={isSelected ? "selected-row" : ""}
                  onClick={() => onSelect(actualIndex)}
                >
                  <td>#{step.iteration}</td>
                  <td>{formatDistance(step.currentCost)}</td>
                  <td>{formatDistance(step.candidateCost)}</td>
                  <td className="best-cell">{formatDistance(step.bestCost)}</td>
                  <td className={delta < 0 ? "impr" : delta > 0 ? "deg" : ""}>
                    {delta > 0 ? `+${formatDistance(delta)}` : formatDistance(delta)}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        step.aspiration
                          ? "status-aspiration"
                          : step.accepted
                            ? "status-accepted"
                            : "status-rejected"
                      }`}
                    >
                      {step.aspiration ? "Aspiration" : step.accepted ? "Accepted" : "Rejected"}
                    </span>
                  </td>
                  <td>
                    <span className="reason-cell">{step.reason}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TraceDetailsComponent({ step, dataset }: { step: TraceStep; dataset: Dataset }) {
  return (
    <div className="step-detail-card">
      <div className="step-detail-header">
        <span className="step-title">Detail Iterasi #{step.iteration}</span>
        <span
          className={`status-pill ${
            step.aspiration
              ? "status-aspiration"
              : step.accepted
                ? "status-accepted"
                : "status-rejected"
          }`}
        >
          {step.aspiration ? "Diterima (Aspiration)" : step.accepted ? "Diterima" : "Ditolak"}
        </span>
      </div>

      <div className="step-detail-grid">
        <div className="step-stat">
          <span className="label">Biaya Current:</span>
          <strong>{formatDistance(step.currentCost)}</strong>
        </div>
        <div className="step-stat">
          <span className="label">Biaya Kandidat:</span>
          <strong>{formatDistance(step.candidateCost)}</strong>
        </div>
        <div className="step-stat">
          <span className="label">Biaya Best:</span>
          <strong className="best-val">{formatDistance(step.bestCost)}</strong>
        </div>
        <div className="step-stat">
          <span className="label">Delta (Kandidat - Current):</span>
          <strong
            className={
              step.candidateCost < step.currentCost
                ? "text-teal-700"
                : step.candidateCost > step.currentCost
                  ? "text-rose-700"
                  : ""
            }
          >
            {step.candidateCost - step.currentCost > 0 ? "+" : ""}
            {formatDistance(step.candidateCost - step.currentCost)}
          </strong>
        </div>
      </div>

      <div className="step-notes">
        <p>
          <strong>Alasan:</strong> {step.reason}
        </p>
        {step.temperature !== undefined && (
          <p>
            <strong>Suhu SA:</strong> {step.temperature.toFixed(4)}
            {step.probability !== undefined && (
              <span> | Peluang Acceptance: {(step.probability * 100).toFixed(2)}%</span>
            )}
          </p>
        )}
        {step.tabu !== undefined && (
          <p>
            <strong>Status Tabu:</strong> {step.tabu ? "Langkah Tabu" : "Eligible"}
          </p>
        )}
      </div>

      {step.move && (
        <div className="step-move">
          <strong>Move:</strong> Pertukaran 2-OPT antara posisi simpul (
          {dataset.nodes[step.move.i]?.id ?? step.move.i}) dan (
          {dataset.nodes[step.move.j]?.id ?? step.move.j})
        </div>
      )}
    </div>
  );
}

function InteractiveMatrixComponent({
  dataset,
  sourceLabel: _sourceLabel,
}: {
  dataset: Dataset;
  sourceLabel: string;
}) {
  const [selectedPair, setSelectedPair] = useState<{ row: number; col: number }>({
    row: 0,
    col: Math.min(1, dataset.nodes.length - 1),
  });
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);

  // Reset selected pair jika dataset berubah
  const prevKeyRef = useRef(datasetKey(dataset));
  useEffect(() => {
    const key = datasetKey(dataset);
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      setHovered(null);
      setSelectedPair({ row: 0, col: Math.min(1, dataset.nodes.length - 1) });
    }
  }, [dataset]);

  const matrix = distanceMatrix(dataset.nodes);

  // Pasangan aktif: prioritas hover bila kursor di atas sel, bila tidak gunakan selectedPair
  const activePair = hovered ?? selectedPair;
  const nodeA = dataset.nodes[activePair.row] ?? dataset.nodes[0]!;
  const nodeB = dataset.nodes[activePair.col] ?? dataset.nodes[0]!;
  const distance = matrix[activePair.row]?.[activePair.col] ?? 0;

  const nodeOptions = dataset.nodes.map((n, idx) => ({
    value: String(idx),
    label: `Node ${n.id} (${n.x}, ${n.y})`,
  }));

  return (
    <div className="interactive-matrix-wrapper">
      {/* 5. Matriks dalam wadah scroll sendiri */}
      <div className="matrix-scroll">
        <table className="interactive-matrix-table" aria-label="Tabel Matriks Jarak Antar Node">
          <thead>
            <tr>
              <th scope="col" className="matrix-corner-cell">
                Node / Titik
              </th>
              {dataset.nodes.map((node, colIdx) => (
                <th
                  scope="col"
                  key={node.id}
                  className={`matrix-col-header ${activePair.col === colIdx ? "col-highlighted" : ""}`}
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
              const isRowActive = activePair.row === rowIdx;

              return (
                <tr key={rowIdx} className={isRowActive ? "row-highlighted" : ""}>
                  <th
                    scope="row"
                    className={`matrix-row-header ${isRowActive ? "row-highlighted" : ""}`}
                  >
                    <span className="header-node-id">{rowNode.id}</span>
                    <span className="header-coords">
                      ({rowNode.x}, {rowNode.y})
                    </span>
                  </th>
                  {row.map((cost, colIdx) => {
                    const isDiagonal = rowIdx === colIdx;
                    const isSelected = selectedPair.row === rowIdx && selectedPair.col === colIdx;
                    const isHoveredCell = hovered?.row === rowIdx && hovered?.col === colIdx;
                    const isCrosshair =
                      (activePair.row === rowIdx || activePair.col === colIdx) && !isDiagonal;

                    return (
                      <td
                        key={colIdx}
                        className={`matrix-cell ${isDiagonal ? "diagonal" : ""} ${
                          isSelected
                            ? "cell-selected"
                            : isHoveredCell
                              ? "cell-intersect"
                              : isCrosshair
                                ? "crosshair-highlight"
                                : ""
                        }`}
                        tabIndex={0}
                        aria-selected={isSelected}
                        onClick={() => setSelectedPair({ row: rowIdx, col: colIdx })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedPair({ row: rowIdx, col: colIdx });
                          }
                        }}
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

      {/* 6. Panel Formula untuk Pasangan Node yang Dipilih */}
      <div className="matrix-formula-card" aria-live="polite">
        <div className="matrix-pair-selectors">
          <span className="font-semibold text-xs text-teal-900 mr-1">Pilih Pasangan Node:</span>
          <div className="matrix-pair-field">
            <span className="text-xs text-slate-500">Simpul i:</span>
            <div className="w-36">
              <Select
                value={String(selectedPair.row)}
                onChange={(val) => setSelectedPair((prev) => ({ ...prev, row: Number(val) }))}
                options={nodeOptions}
              />
            </div>
          </div>
          <div className="matrix-pair-field">
            <span className="text-xs text-slate-500">Simpul j:</span>
            <div className="w-36">
              <Select
                value={String(selectedPair.col)}
                onChange={(val) => setSelectedPair((prev) => ({ ...prev, col: Number(val) }))}
                options={nodeOptions}
              />
            </div>
          </div>
          <span className="text-[11px] text-teal-700 italic ml-auto">
            (Klik sel pada matriks atau pilih simpul di atas)
          </span>
        </div>

        <div className="mt-2">
          <span className="text-teal-900 font-semibold block mb-1">
            Jarak antara Node {nodeA.id} ({nodeA.x}, {nodeA.y}) dan Node {nodeB.id} ({nodeB.x},{" "}
            {nodeB.y}):
          </span>
          {activePair.row === activePair.col ? (
            <div className="font-mono text-xs text-slate-600 bg-white/70 p-2 rounded border border-teal-200 inline-block">
              d({nodeA.id}, {nodeB.id}) = 0.000 {dataset.unit} (Jarak ke diri sendiri / simpul sama)
            </div>
          ) : (
            <div className="font-mono text-xs text-teal-950 bg-white p-2.5 rounded border border-teal-200">
              d({nodeA.id}, {nodeB.id}) = √(({nodeB.x} - {nodeA.x})² + ({nodeB.y} - {nodeA.y})²)
              <span className="block mt-1 text-teal-800 font-bold">
                = √({Math.pow(nodeB.x - nodeA.x, 2).toFixed(3)} +{" "}
                {Math.pow(nodeB.y - nodeA.y, 2).toFixed(3)}) = {formatNumber(distance)}{" "}
                {dataset.unit}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
