import { Play, Pause, Square, ArrowRightLeft, Settings2 } from "lucide-react";
import { Button, Field } from "../../components/ui";
import { validateConfig, type RunConfig, type RunResult } from "../../domain/algorithms/experiment";
import type { Dataset } from "../../domain/tsp/model";
export function ConfigPanel({
  dataset,
  config,
  phase,
  ready,
  onChange,
  onStart,
  onPause,
  onCancel,
  onRepeat,
  run,
}: {
  dataset: Dataset;
  config: RunConfig;
  phase: "idle" | "running" | "paused";
  ready: boolean;
  onChange: (config: RunConfig) => void;
  onStart: () => void;
  onPause: () => void;
  onCancel: () => void;
  onRepeat: () => void;
  run: RunResult | null;
}) {
  const busy = phase !== "idle",
    errors = validateConfig(config, dataset);
  const number = (key: keyof RunConfig, value: string) =>
    onChange({ ...config, [key]: value.trim() === "" ? NaN : Number(value) });
  const numeric = (
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
        onChange={(event) => number(key, event.target.value)}
      />
    </Field>
  );
  return (
    <section className="panel configuration" aria-labelledby="config-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">02 · EKSPERIMEN</span>
          <h2 id="config-title">Atur pencarian</h2>
        </div>
        <Settings2 size={19} className="muted" />
      </div>
      <div className="two-fields">
        <Field label="Solusi awal">
          <select
            disabled={busy}
            value={config.initialMethod}
            onChange={(event) =>
              onChange({ ...config, initialMethod: event.target.value as "NN" | "NI" })
            }
          >
            <option value="NN">Nearest Neighbor</option>
            <option value="NI">Nearest Insertion</option>
          </select>
        </Field>
        <Field label="Titik awal">
          <select
            disabled={busy}
            value={config.startId}
            onChange={(event) => onChange({ ...config, startId: event.target.value })}
          >
            {dataset.nodes.map((node) => (
              <option key={node.id}>{node.id}</option>
            ))}
          </select>
        </Field>
      </div>
      <label className="checkbox-field">
        <input
          type="checkbox"
          disabled={busy}
          checked={config.improve !== "none"}
          onChange={(event) =>
            onChange({ ...config, improve: event.target.checked ? "2OPT" : "none" })
          }
        />
        <span>Perbaiki solusi awal dengan 2-OPT</span>
      </label>
      <Field label="Metode optimasi">
        <select
          disabled={busy}
          value={config.algorithm}
          onChange={(event) =>
            onChange({ ...config, algorithm: event.target.value as "TS" | "SA" })
          }
        >
          <option value="TS">Tabu Search</option>
          <option value="SA">Simulated Annealing</option>
        </select>
      </Field>
      <p className="method-note">
        {config.algorithm === "TS"
          ? "Jelajahi kandidat terbaik, hindari langkah tabu, dan izinkan aspiration."
          : "Terima langkah lebih buruk secara probabilistik sambil menurunkan suhu."}
      </p>
      <div className="two-fields">
        {numeric("maxIterations", "Batas iterasi", 1, 10000)}
        {config.algorithm === "TS"
          ? numeric("tenure", "Tabu tenure", 1, 100)
          : numeric("seed", "Seed", 0, 4294967295)}
      </div>
      {config.algorithm === "SA" && (
        <>
          <div className="two-fields">
            {numeric("initialTemperature", "Suhu awal", 0, undefined, "any")}
            {numeric("coolingRate", "Cooling rate", 0, 1, "any")}
          </div>
          <div className="two-fields">
            {numeric("iterationsPerTemperature", "Iterasi per suhu", 1, 10000)}
            {numeric("minimumTemperature", "Suhu minimum", 0, undefined, "any")}
          </div>
        </>
      )}
      <p className="small muted">Neighborhood 2-OPT · maksimal 10.000 iterasi.</p>
      {errors.length > 0 && (
        <ul className="errors" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <div className="run-controls">
        {!busy ? (
          <Button
            size="lg"
            disabled={!ready || errors.length > 0}
            onClick={onStart}
            className="run-button"
          >
            <Play size={17} fill="currentColor" />
            Jalankan eksperimen
          </Button>
        ) : (
          <>
            <Button variant="secondary" disabled={!ready} onClick={onPause}>
              {phase === "paused" ? <Play size={16} /> : <Pause size={16} />}{" "}
              {phase === "paused" ? "Lanjutkan" : "Jeda"}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              <Square size={15} />
              Batalkan
            </Button>
          </>
        )}
      </div>
      {!busy && run && (
        <Button variant="ghost" size="sm" onClick={onRepeat} className="repeat-button">
          <ArrowRightLeft size={14} />
          Jalankan metode lain
        </Button>
      )}
    </section>
  );
}
