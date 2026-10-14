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
import { Button, Field, formatNumber } from "../../components/ui";
import { Select } from "../../components/ui/select";
import { validateConfig, type RunConfig, type RunResult } from "../../domain/algorithms/experiment";
import type { Dataset } from "../../domain/tsp/model";

export function ControlHub({
  dataset,
  config,
  phase,
  ready,
  run,
  runs,
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
            <div className="two-fields">
              <Field label="Solusi Awal">
                <Select
                  disabled={busy}
                  value={config.initialMethod}
                  options={[
                    {
                      value: "NN",
                      label: "Nearest Neighbor",
                      description: "Pilih titik terdekat berikutnya",
                    },
                    {
                      value: "NI",
                      label: "Nearest Insertion",
                      description: "Sisipkan node dengan delta terendah",
                    },
                  ]}
                  onChange={(val) =>
                    onConfigChange({ ...config, initialMethod: val as "NN" | "NI" })
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

            <label className="checkbox-field">
              <input
                type="checkbox"
                disabled={busy}
                checked={config.improve}
                onChange={(e) => onConfigChange({ ...config, improve: e.target.checked })}
              />
              <span>Perbaiki solusi awal dengan 2-OPT</span>
            </label>

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
                {numericField("tenure", "Tabu tenure", 1, 50)}
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
                  {numericField("iterationsPerTemperature", "Iter/Suhu", 1, 1000)}
                  {numericField("seed", "RNG Seed", 0, 1000000)}
                </div>
              </div>
            )}

            {numericField("maxIterations", "Batas Iterasi Maksimal", 1, 10000)}

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
                  <span>Jalankan Eksperimen</span>
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
                    Ulangi dengan{" "}
                    {config.algorithm === "TS" ? "Simulated Annealing" : "Tabu Search"}
                  </span>
                </Button>
              )}
            </div>
          </div>

          {/* Live Metrics Snapshot */}
          <div className="live-metrics-box">
            <span className="box-title">HASIL TERBARU</span>
            <div className="metrics-grid">
              <div className="metric-cell primary">
                <span className="metric-label">Jarak Terbaik</span>
                <strong className="metric-value">{run ? formatNumber(run.bestCost) : "—"}</strong>
                <small className="metric-sub">{dataset.unit}</small>
              </div>

              <div className="metric-cell">
                <span className="metric-label">Peningkatan</span>
                <strong className="metric-value">{run ? `${improvement.toFixed(2)}%` : "—"}</strong>
                <small className="metric-sub">
                  Awal: {run ? formatNumber(run.initialCost) : "—"}
                </small>
              </div>

              <div className="metric-cell">
                <span className="metric-label">Iterasi</span>
                <strong className="metric-value">
                  {run ? run.iterations.toLocaleString("id-ID") : "—"}
                </strong>
                <small className="metric-sub">
                  {run ? `${run.evaluations.toLocaleString("id-ID")} kandidat` : "—"}
                </small>
              </div>

              <div className="metric-cell">
                <span className="metric-label">Waktu</span>
                <strong className="metric-value">
                  {run ? `${(run.durationMs / 1000).toFixed(2)}s` : "—"}
                </strong>
                <small className="metric-sub">{run ? run.config.algorithm : "TS/SA"}</small>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Runs Tab (Recent Experiments) */
        <div className="runs-history-content">
          <div className="control-header">
            <div>
              <span className="eyebrow">RIWAYAT SESI</span>
              <h3 className="section-title">Hasil yang Pernah Dijalankan</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={onOpenReport}>
              Lihat Report Penuh
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
                const runImpr =
                  r.initialCost === 0 ? 0 : ((r.initialCost - r.bestCost) / r.initialCost) * 100;

                return (
                  <button
                    type="button"
                    key={r.id}
                    className={`run-card text-left w-full ${isSelected ? "selected" : ""}`}
                    onClick={() => onSelectRun(r.id)}
                    aria-label={`Pilih run #${runs.length - index} ${r.config.algorithm} ${r.dataset.name}`}
                  >
                    <div className="run-card-header">
                      <div className="flex items-center gap-2">
                        <span className="run-index">#{runs.length - index}</span>
                        <strong className="algorithm-tag">{r.config.algorithm}</strong>
                        <span className="run-dataset-name">{r.dataset.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="run-duration">
                          <Clock size={11} /> {(r.durationMs / 1000).toFixed(2)}s
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          className="delete-run-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveRun(r.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              onRemoveRun(r.id);
                            }
                          }}
                          title="Hapus run dari riwayat"
                          aria-label={`Hapus run #${runs.length - index}`}
                        >
                          <Trash2 size={12} />
                        </span>
                      </div>
                    </div>

                    <div className="run-card-body">
                      <div>
                        <span className="run-cost-label">Jarak Terbaik:</span>
                        <span className="run-best-cost">{formatNumber(r.bestCost)}</span>
                      </div>
                      <div className="run-improvement">
                        <TrendingDown size={12} />
                        <span>{runImpr.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="run-card-footer">
                      <span className="run-meta">
                        {r.config.initialMethod} · {r.iterations} iter
                      </span>
                      {isSelected && <span className="active-badge">Aktif di kanvas</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
