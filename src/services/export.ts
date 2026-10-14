import { closedRoute } from "../domain/tsp/model";
import type { RunResult } from "../domain/algorithms/experiment";
function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportRun(run: RunResult) {
  download(
    JSON.stringify(
      {
        schemaVersion: 1,
        ...run,
        closedInitialRoute: closedRoute(run.initialRoute, run.dataset),
        closedBestRoute: closedRoute(run.bestRoute, run.dataset),
      },
      null,
      2,
    ),
    "application/json",
    `heurilab-${run.config.algorithm}-${run.id}.json`,
  );
}
const csvCell = (value: unknown) =>
  `"${String(value ?? "")
    .replace(/^[=+\-@]/, "'$&")
    .replaceAll('"', '""')}"`;
export function comparisonCsv(runs: RunResult[]): string {
  const rows: unknown[][] = [
    [
      "run_id",
      "dataset",
      "distance_model",
      "unit",
      "method",
      "initial_method",
      "two_opt",
      "start",
      "seed",
      "max_iterations",
      "initial_distance",
      "best_distance",
      "improvement_percent",
      "iterations",
      "evaluations",
      "duration_ms",
      "status",
      "stop_reason",
      "parameters",
      "best_route",
    ],
  ];
  for (const run of runs)
    rows.push([
      run.id,
      run.dataset.name,
      "euclidean",
      run.dataset.unit,
      run.config.algorithm,
      run.config.initialMethod,
      run.config.improve,
      run.config.startId,
      run.config.seed,
      run.config.maxIterations,
      run.initialCost,
      run.bestCost,
      run.initialCost === 0 ? 0 : ((run.initialCost - run.bestCost) / run.initialCost) * 100,
      run.iterations,
      run.evaluations,
      run.durationMs,
      run.status,
      run.stopReason,
      JSON.stringify(run.config),
      closedRoute(run.bestRoute, run.dataset).join(" → "),
    ]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function exportComparison(runs: RunResult[]) {
  download("\ufeff" + comparisonCsv(runs), "text/csv;charset=utf-8", "heurilab-perbandingan.csv");
}
