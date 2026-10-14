import { Download, Eye } from "lucide-react";
import { Button, Empty, formatNumber } from "../../components/ui";
import { datasetKey, closedRoute } from "../../domain/tsp/model";
import type { RunResult } from "../../domain/algorithms/experiment";
import { exportComparison } from "../../services/export";
function conditions(run: RunResult) {
  return JSON.stringify([datasetKey(run.dataset), run.initialRoute, run.config.maxIterations]);
}
export function Comparison({
  runs,
  disabled,
  onSelect,
}: {
  runs: RunResult[];
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  if (!runs.length)
    return (
      <Empty title="Bandingkan dari data yang sama">
        Hasil eksperimen muncul di sini. Jalankan TS dan SA untuk membandingkan rute serta biaya.
      </Empty>
    );
  return (
    <>
      <div className="trace-toolbar">
        <p className="small muted">10 run terakhir. Kondisi dibandingkan terhadap run teratas.</p>
        <Button size="sm" variant="secondary" onClick={() => exportComparison(runs)}>
          <Download size={14} />
          Ekspor CSV
        </Button>
      </div>
      <p className="notice small">
        Satu iterasi TS mengevaluasi seluruh neighborhood; SA mengambil satu kandidat. Iterasi sama
        memiliki biaya komputasi berbeda. Run yang dibatalkan menampilkan hasil parsial.
      </p>
      <div className="table-scroll">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Metode / dataset</th>
              <th>Awal → best</th>
              <th>Iterasi / evaluasi</th>
              <th>Waktu</th>
              <th>Konfigurasi</th>
              <th>Kondisi</th>
              <th>Rute akhir / detail</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  <strong>{run.config.algorithm}</strong>
                  <small>{run.dataset.name}</small>
                  <small>
                    {run.status === "cancelled" ? "Dibatalkan · parsial" : "Selesai"} ·{" "}
                    {run.dataset.unit}
                  </small>
                </td>
                <td>
                  {formatNumber(run.initialCost)}
                  <strong className="best-cell">{formatNumber(run.bestCost)}</strong>
                  <small>
                    {(run.initialCost === 0
                      ? 0
                      : ((run.initialCost - run.bestCost) / run.initialCost) * 100
                    ).toFixed(2)}
                    % perbaikan
                  </small>
                </td>
                <td>
                  {run.iterations}
                  <small>{run.evaluations} kandidat</small>
                </td>
                <td>{(run.durationMs / 1000).toFixed(2)} s</td>
                <td>
                  {run.config.initialMethod}
                  {run.config.improve ? " + 2-OPT" : ""}
                  <small>
                    start {run.config.startId} · budget {run.config.maxIterations}
                  </small>
                  <small>
                    {run.config.algorithm === "TS"
                      ? `tenure ${run.config.tenure}`
                      : `seed ${run.config.seed} · T₀ ${run.config.initialTemperature} · cooling ${run.config.coolingRate}`}
                  </small>
                </td>
                <td>
                  <span
                    className={`condition-tag ${conditions(run) === conditions(runs[0]!) ? "same" : "different"}`}
                  >
                    {conditions(run) === conditions(runs[0]!) ? "Sama" : "Berbeda"}
                  </span>
                </td>
                <td>
                  <small className="comparison-route">
                    {closedRoute(run.bestRoute, run.dataset).join(" → ")}
                  </small>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onSelect(run.id)}
                  >
                    <Eye size={13} />
                    Lihat run {run.config.algorithm}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
