import { useState } from "react";
import {
  Play,
  Pause,
  Square,
  ArrowRightLeft,
  Settings2,
  Clock,
  TrendingDown,
  Activity,
  History,
  Trash2,
} from "lucide-react";
import { Button, Field, stopLabels } from "../../components/ui";
import { Select } from "../../components/ui/select";
import {
  validateConfig,
  type ExperimentCategory,
  type ImprovementMethod,
  type InitialMethod,
  type RunConfig,
  type RunResult,
  EPSILON,
} from "../../domain/algorithms/experiment";
import type { Dataset } from "../../domain/tsp/model";
import {
  formatDistance,
  formatPercent,
  formatDuration,
  getMethodShortLabel,
  getMethodDisplayName,
} from "../report/formatters";

export function ControlHub({
  dataset,
  config,
  phase,
  ready,
  run,
  runs,
  previewCost,
  onConfigChange,
  onStart,
  onPause,
  onCancel,
  onRepeat,
  onSelectRun,
  onRemoveRun,
  onOpenReport,
}: {
  dataset: Dataset;
  config: RunConfig;
  phase: "idle" | "running" | "paused";
  ready: boolean;
  run: RunResult | null;
  runs: RunResult[];
  previewCost?: number;
  onConfigChange: (config: RunConfig) => void;
  onStart: () => void;
  onPause: () => void;
  onCancel: () => void;
  onRepeat: () => void;
  onSelectRun: (id: string) => void;
  onRemoveRun: (id: string) => void;
  onOpenReport: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"config" | "runs">("config");

  const busy = phase !== "idle";
  const errors = validateConfig(config, dataset);

  const numberChange = (key: keyof RunConfig, value: string) =>
    onConfigChange({ ...config, [key]: value.trim() === "" ? NaN : Number(value) });

  const numericField = (
    key: keyof RunConfig,
    label: string,
    min: number,
    max?: number,
    step?: string,
  ) => (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        disabled={busy}
        value={Number.isFinite(config[key] as number) ? String(config[key]) : ""}
        onChange={(e) => numberChange(key, e.target.value)}
      />
    </Field>
  );

  const setCategory = (category: ExperimentCategory) => {
    let algorithm = config.algorithm;
    if (category === "construction") {
      algorithm = config.initialMethod === "random" ? "NN" : config.initialMethod;
    } else if (category === "local-search") {
      algorithm = "2OPT";
    } else if (category === "metaheuristic") {
      algorithm = algorithm === "SA" ? "SA" : "TS";
    }
    onConfigChange({
      ...config,
      category,
      algorithm,
    });
  };

  const improvement = run
    ? run.initialCost === 0
      ? 0
      : ((run.initialCost - run.bestCost) / run.initialCost) * 100
    : 0;

  return (
    <div className="control-hub-card">
      {/* Tab Switcher at Top of Panel 4 */}
      <div className="control-hub-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === "config" ? "active" : ""}`}
          onClick={() => setActiveTab("config")}
        >
          <Settings2 size={15} />
          <span>Eksperimen</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "runs" ? "active" : ""}`}
          onClick={() => setActiveTab("runs")}
        >
          <History size={15} />
          <span>Riwayat Run ({runs.length})</span>
        </button>
      </div>

      {activeTab === "config" ? (
        <div className="control-content">
          {/* Main Controls Header */}
          <div className="control-header">
            <div>
              <span className="eyebrow">METODE & PARAMETER</span>
              <h3 className="section-title">Konfigurasi Algoritma</h3>
            </div>
            <span className={`status-pill ${busy ? "live" : ""}`}>
              <i />
              {phase === "running" ? "Mencari..." : phase === "paused" ? "Dijeda" : "Siap"}
            </span>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            {/* Category Selector */}
            <Field label="Jenis Eksperimen">
              <Select
                disabled={busy}
                value={config.category}
                options={[
                  {
                    value: "metaheuristic",
                    label: "Metaheuristik (TS / SA)",
                    description: "Optimasi dengan Tabu Search atau Simulated Annealing",
                  },
                  {
                    value: "local-search",
                    label: "Local Search (2-OPT / 3-OPT)",
                    description: "Perbaikan rute dasar menggunakan local search descent",
                  },
                  {
                    value: "construction",
                    label: "Pembentukan Solusi Awal",
                    description: "Konstruksi rute dasar (NN, NI, atau NFI)",
                  },
                ]}
                onChange={(val) => setCategory(val as ExperimentCategory)}
                ariaLabel="Pilih jenis eksperimen"
              />
            </Field>

            {/* 1. Construction Fields */}
            {config.category === "construction" && (
              <div className="space-y-3">
                <div className="two-fields">
                  <Field label="Metode Konstruktif">
                    <Select
                      disabled={busy}
                      value={config.initialMethod}
                      options={[
                        {
                          value: "NN",
                          label: "Nearest Neighbor (NN)",
                          description: "Pilih titik terdekat berikutnya",
                        },
                        {
                          value: "NI",
                          label: "Nearest Insertion (NI)",
                          description: "Sisipkan node terdekat dengan delta minimal",
                        },
                        {
                          value: "NFI",
                          label: "Nearest Farthest Insertion (NFI)",
                          description: "Sisipkan node terjauh dari tour",
                        },
                      ]}
                      onChange={(val) => {
                        const m = val as "NN" | "NI" | "NFI";
                        onConfigChange({ ...config, initialMethod: m, algorithm: m });
                      }}
                      ariaLabel="Pilih metode konstruktif"
                    />
                  </Field>

                  <Field label="Titik Awal">
                    <Select
                      disabled={busy}
                      value={config.startId}
                      options={dataset.nodes.map((node) => ({
                        value: node.id,
                        label: `Node ${node.id} (${node.x}, ${node.y})`,
                      }))}
                      onChange={(val) => onConfigChange({ ...config, startId: val })}
                      ariaLabel="Pilih titik awal tour"
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* 2. Local Search Fields */}
            {config.category === "local-search" && (
              <div className="space-y-3">
                <div className="two-fields">
                  <Field label="Rute Dasar">
                    <Select
                      disabled={busy}
                      value={config.initialMethod}
                      options={[
                        ...(dataset.randomTourNodeIds &&
                        dataset.randomTourNodeIds.length === dataset.nodes.length
                          ? [
                              {
                                value: "random",
                                label: "Rute Acak (Belum Diperbaiki)",
                                description: "Snapshot permutasi acak awal tanpa optimasi",
                              },
                            ]
                          : []),
                        {
                          value: "NN",
                          label: "Nearest Neighbor (NN)",
                          description: "Rute dasar NN",
                        },
                        {
                          value: "NI",
                          label: "Nearest Insertion (NI)",
                          description: "Rute dasar NI",
                        },
                        {
                          value: "NFI",
                          label: "Nearest Farthest Insertion (NFI)",
                          description: "Rute dasar NFI",
                        },
                      ]}
                      onChange={(val) =>
                        onConfigChange({ ...config, initialMethod: val as InitialMethod })
                      }
                      ariaLabel="Pilih rute dasar konstruksi"
                    />
                  </Field>

                  <Field label="Titik Awal">
                    <Select
                      disabled={busy}
                      value={config.startId}
                      options={dataset.nodes.map((node) => ({
                        value: node.id,
                        label: `Node ${node.id} (${node.x}, ${node.y})`,
                      }))}
                      onChange={(val) => onConfigChange({ ...config, startId: val })}
                      ariaLabel="Pilih titik awal tour"
                    />
                  </Field>
                </div>

                <Field label="Metode Local Search">
                  <Select
                    disabled={busy}
                    value={config.algorithm}
                    options={[
                      {
                        value: "2OPT",
                        label: "2-OPT Descent",
                        description: "Pembalikan dua sisi hingga tidak ada perbaikan",
                      },
                      {
                        value: "3OPT",
                        label: "3-OPT Descent",
                        description: "Evaluasi 7 rekoneksi tiga sisi tidak bersebelahan",
                      },
                    ]}
                    onChange={(val) =>
                      onConfigChange({
                        ...config,
                        algorithm: val as "2OPT" | "3OPT",
                        improve: val as "2OPT" | "3OPT",
                      })
                    }
                    ariaLabel="Pilih metode local search"
                  />
                </Field>
              </div>
            )}

            {/* 3. Metaheuristic Fields */}
            {config.category === "metaheuristic" && (
              <div className="space-y-3">
                <div className="two-fields">
                  <Field label="Solusi Awal">
                    <Select
                      disabled={busy}
                      value={config.initialMethod}
                      options={[
                        ...(dataset.randomTourNodeIds &&
                        dataset.randomTourNodeIds.length === dataset.nodes.length
                          ? [
                              {
                                value: "random",
                                label: "Rute Acak (Belum Diperbaiki)",
                                description: "Snapshot permutasi acak awal tanpa optimasi",
                              },
                            ]
                          : []),
                        {
                          value: "NN",
                          label: "Nearest Neighbor (NN)",
                          description: "Pilih titik terdekat berikutnya",
                        },
                        {
                          value: "NI",
                          label: "Nearest Insertion (NI)",
                          description: "Sisipkan node terdekat dengan delta minimal",
                        },
                        {
                          value: "NFI",
                          label: "Nearest Farthest Insertion (NFI)",
                          description: "Sisipkan node terjauh dari tour",
                        },
                      ]}
                      onChange={(val) =>
                        onConfigChange({ ...config, initialMethod: val as InitialMethod })
                      }
                      ariaLabel="Pilih solusi awal"
                    />
                  </Field>

                  <Field label="Titik Awal">
                    <Select
                      disabled={busy}
                      value={config.startId}
                      options={dataset.nodes.map((node) => ({
                        value: node.id,
                        label: `Node ${node.id} (${node.x}, ${node.y})`,
                      }))}
                      onChange={(val) => onConfigChange({ ...config, startId: val })}
                      ariaLabel="Pilih titik awal tour"
                    />
                  </Field>
                </div>

                <Field label="Perbaikan Solusi Awal">
                  <Select
                    disabled={busy}
                    value={config.improve}
                    options={[
                      {
                        value: "none",
                        label: "Tidak ada (Rute Dasar Langsung)",
                        description: "Gunakan rute konstruktif tanpa perbaikan awal",
                      },
                      {
                        value: "2OPT",
                        label: "Perbaiki dengan 2-OPT",
                        description: "Jalankan 2-OPT descent sebelum metaheuristik",
                      },
                      {
                        value: "3OPT",
                        label: "Perbaiki dengan 3-OPT",
                        description: "Jalankan 3-OPT descent sebelum metaheuristik",
                      },
                    ]}
                    onChange={(val) =>
                      onConfigChange({ ...config, improve: val as ImprovementMethod })
                    }
                    ariaLabel="Pilih perbaikan solusi awal"
                  />
                </Field>

                <Field label="Metode Optimasi">
                  <Select
                    disabled={busy}
                    value={config.algorithm}
                    options={[
                      {
                        value: "TS",
                        label: "Tabu Search (TS)",
                        description: "Pencarian 2-OPT dengan memori tabu list & aspiration",
                      },
                      {
                        value: "SA",
                        label: "Simulated Annealing (SA)",
                        description: "Pendinginan termal & probabilitas exp(-Δ/T)",
                      },
                    ]}
                    onChange={(val) => onConfigChange({ ...config, algorithm: val as "TS" | "SA" })}
                    ariaLabel="Pilih metode optimasi"
                  />
                </Field>

                {config.algorithm === "TS" ? (
                  <div className="algorithm-subpanel">
                    <span className="panel-sublabel">Parameter Tabu Search</span>
                    {numericField("tenure", "Tabu tenure", 1, 100)}
                    <div className="text-xs text-slate-500 bg-white/70 p-2 rounded border border-slate-200">
                      <strong>Aspiration:</strong> Aktif otomatis bila kandidat tabu mengalahkan
                      best-so-far.
                    </div>
                  </div>
                ) : (
                  <div className="algorithm-subpanel">
                    <span className="panel-sublabel">Parameter Simulated Annealing</span>
                    <div className="two-fields">
                      {numericField("initialTemperature", "Suhu Awal (T₀)", 0.001, 10000, "0.1")}
                      {numericField("coolingRate", "Cooling Rate (α)", 0.0001, 0.9999, "0.01")}
                    </div>
                    <div className="two-fields">
                      {numericField("iterationsPerTemperature", "Iter/Suhu", 1, 10000)}
                      {numericField(
                        "minimumTemperature",
                        "Suhu Minimum (T_min)",
                        0.00001,
                        1000,
                        "0.001",
                      )}
                    </div>
                    {numericField("seed", "RNG Seed", 0, 4294967295)}
                  </div>
                )}

                {numericField("maxIterations", "Batas Iterasi Maksimal", 1, 10000)}
              </div>
            )}

            {errors.length > 0 && (
              <ul className="errors-list" role="alert">
                {errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            )}

            {/* Action Buttons */}
            <div className="action-buttons-grid">
              {!busy ? (
                <Button
                  onClick={onStart}
                  disabled={!ready || errors.length > 0 || dataset.nodes.length < 3}
                  className="w-full justify-center"
                >
                  <Play size={16} />
                  <span>
                    {config.category === "construction"
                      ? "Bentuk Solusi Awal"
                      : config.category === "local-search"
                        ? "Jalankan Local Search"
                        : "Jalankan Metaheuristik"}
                  </span>
                </Button>
              ) : (
                <div className="flex gap-2 w-full">
                  <Button variant="outline" onClick={onPause} className="flex-1 justify-center">
                    {phase === "paused" ? <Play size={15} /> : <Pause size={15} />}
                    <span>{phase === "paused" ? "Lanjut" : "Jeda"}</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onCancel}
                    className="flex-1 justify-center text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Square size={15} />
                    <span>Batal</span>
                  </Button>
                </div>
              )}

              {run && !busy && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRepeat}
                  className="w-full justify-center"
                >
                  <ArrowRightLeft size={14} />
                  <span>
                    {run.category === "metaheuristic"
                      ? `Ulangi dengan ${config.algorithm === "TS" ? "Simulated Annealing" : "Tabu Search"}`
                      : run.category === "local-search"
                        ? `Ulangi dengan ${config.algorithm === "2OPT" ? "3-OPT" : "2-OPT"}`
                        : "Bentuk Ulang Rute"}
                  </span>
                </Button>
              )}
            </div>
          </div>

          {/* Live Metrics Snapshot */}
          <div className="live-metrics-box">
            <div className="flex items-center justify-between mb-2">
              <span className="box-title">{run ? "HASIL TERBARU" : "PRATINJAU RUTE"}</span>
              {run ? (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {stopLabels[run.stopReason] ?? run.stopReason}
                </span>
              ) : dataset.randomTourNodeIds ? (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  Rute acak awal — belum diperbaiki
                </span>
              ) : (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Urutan data awal
                </span>
              )}
            </div>
            <div className="metrics-grid">
              <div className="metric-cell primary">
                <span className="metric-label">{run ? "Jarak Terbaik" : "Jarak Awal"}</span>
                <strong className="metric-value font-tabular">
                  {run
                    ? formatDistance(run.bestCost)
                    : previewCost !== undefined
                      ? formatDistance(previewCost)
                      : "—"}
                </strong>
                <small className="metric-sub">{dataset.unit}</small>
              </div>

              <div className="metric-cell">
                <span className="metric-label">{run ? "Peningkatan" : "Seed Data"}</span>
                <strong className="metric-value font-tabular">
                  {run
                    ? run.category === "construction"
                      ? "—"
                      : Math.abs(run.initialCost - run.bestCost) <= EPSILON
                        ? "0,00%"
                        : improvement < 0.01
                          ? "<0,01%"
                          : formatPercent(improvement)
                    : dataset.generator?.seed !== undefined
                      ? dataset.generator.seed
                      : "—"}
                </strong>
                <small className="metric-sub">
                  {run
                    ? `Awal: ${formatDistance(run.initialCost)}`
                    : dataset.generator
                      ? dataset.generator.isEdited
                        ? "Telah diedit"
                        : "Sintetis deterministik"
                      : "Manual / Contoh"}
                </small>
              </div>

              <div className="metric-cell">
                <span className="metric-label">
                  {run ? (run.category === "local-search" ? "Langkah" : "Iterasi") : "Distribusi"}
                </span>
                <strong className="metric-value font-tabular">
                  {run
                    ? run.category === "construction"
                      ? "—"
                      : run.iterations.toLocaleString("id-ID")
                    : dataset.generator
                      ? dataset.generator.distribution === "cluster"
                        ? `Cluster (${dataset.generator.clusterCount ?? 3})`
                        : "Merata"
                      : "Dataset aktif"}
                </strong>
                <small className="metric-sub">
                  {run
                    ? run.category !== "construction"
                      ? `${run.evaluations.toLocaleString("id-ID")} kandidat`
                      : "Konstruktif"
                    : `${dataset.nodes.length} node`}
                </small>
              </div>

              <div className="metric-cell">
                <span className="metric-label">{run ? "Waktu" : "Status"}</span>
                <strong className="metric-value font-tabular">
                  {run ? formatDuration(run.durations?.totalMs ?? run.durationMs) : "Belum Jalan"}
                </strong>
                <small className="metric-sub">
                  {run ? getMethodShortLabel(run) : "Klik Jalankan untuk memulai"}
                </small>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Runs Tab (Recent Experiments) */
        <div className="runs-history-content">
          <div className="control-header history-header">
            <div>
              <h3 className="section-title">Riwayat eksperimen</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={onOpenReport}>
              Buka Report
            </Button>
          </div>

          {runs.length === 0 ? (
            <div className="empty-runs-state">
              <Activity size={24} className="text-slate-400 mb-2" />
              <p className="font-semibold text-slate-700">Belum ada eksperimen</p>
              <p className="text-xs text-slate-500">
                Pilih metode dan klik Jalankan untuk melihat riwayat run di sini.
              </p>
            </div>
          ) : (
            <div className="runs-list">
              {runs.map((r, index) => {
                const isSelected = run?.id === r.id;
                const isNoChange =
                  r.category !== "construction" && Math.abs(r.initialCost - r.bestCost) <= EPSILON;
                const rawImpr =
                  r.initialCost === 0 ? 0 : ((r.initialCost - r.bestCost) / r.initialCost) * 100;

                return (
                  <div key={r.id} className={`run-card ${isSelected ? "selected" : ""}`}>
                    <button
                      type="button"
                      className="run-card-main-action"
                      onClick={() => onSelectRun(r.id)}
                      aria-label={`Pilih run #${runs.length - index} ${getMethodDisplayName(r)} pada dataset ${r.dataset.name}`}
                    >
                      {/* Baris 1: Metode & ID & Durasi */}
                      <div className="run-card-header">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="run-index">#{runs.length - index}</span>
                          <strong className="algorithm-tag truncate">
                            {getMethodShortLabel(r)}
                          </strong>
                          <span className="text-slate-400 text-xs">·</span>
                          <span className="text-[11px] font-mono text-slate-500">
                            #{r.id.slice(0, 6)}
                          </span>
                        </div>
                        <span className="run-duration font-tabular">
                          <Clock size={11} /> {formatDuration(r.durations?.totalMs ?? r.durationMs)}
                        </span>
                      </div>

                      {/* Baris 2: Dataset */}
                      <div className="run-card-dataset">
                        <span className="run-dataset-name">{r.dataset.name}</span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          ({r.dataset.nodes.length} node)
                        </span>
                      </div>

                      {/* Baris 3: Jarak & Status Perbaikan */}
                      <div className="run-card-body">
                        <div className="flex items-baseline gap-1.5">
                          <span className="run-cost-label">Jarak:</span>
                          <strong className="run-best-cost font-tabular">
                            {formatDistance(r.bestCost)}
                          </strong>
                        </div>
                        {r.category !== "construction" &&
                          (isNoChange ? (
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              0,00%
                            </span>
                          ) : (
                            <div className="run-improvement">
                              <TrendingDown size={11} />
                              <span className="font-tabular">
                                {rawImpr < 0.01 ? "<0,01%" : formatPercent(rawImpr)}
                              </span>
                            </div>
                          ))}
                      </div>

                      {/* Baris 4: Meta & Status Aktif di Kanvas */}
                      <div className="run-card-footer">
                        <span className="run-meta">
                          {r.category === "construction"
                            ? `Start: ${r.config.startId}`
                            : r.category === "local-search"
                              ? `Basis: ${r.config.initialMethod} · ${r.iterations} langkah`
                              : `${r.config.initialMethod}${r.config.improve !== "none" ? `+${r.config.improve}` : ""} · ${r.iterations} iter`}
                        </span>
                        {isSelected && <span className="active-badge">Ditampilkan di kanvas</span>}
                      </div>
                    </button>

                    {/* Sibling Delete Button */}
                    <button
                      type="button"
                      className="delete-run-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveRun(r.id);
                      }}
                      title="Hapus run dari riwayat"
                      aria-label={`Hapus run #${runs.length - index} (${r.id.slice(0, 8)})`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
