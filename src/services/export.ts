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
        schemaVersion: 2,
        ...run,
        closedInitialRoute: closedRoute(run.initialRoute, run.dataset),
        closedPreparedInitialRoute: run.preparedInitialRoute
          ? closedRoute(run.preparedInitialRoute, run.dataset)
          : undefined,
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
export function comparisonCsv(runs: RunResult[], sideMap?: Record<string, "A" | "B">): string {
  const includeSide = !!sideMap;
  const rows: unknown[][] = [
    [
      ...(includeSide ? ["side"] : []),
      "run_id",
      "category",
      "dataset",
      "distance_model",
      "unit",
      "method",
      "initial_method",
      "improvement_method",
      "two_opt",
      "start",
      "seed",
      "max_iterations",
      "initial_distance",
      "best_distance",
      "improvement_percent",
      "iterations",
      "evaluations",
      "construction_time_ms",
      "preparation_time_ms",
      "search_time_ms",
      "total_duration_ms",
      "status",
      "stop_reason",
      "parameters",
      "initial_route",
      "best_route",
      "data_seed",
      "distribution",
      "prepared_initial_distance",
      "prepared_initial_route",
    ],
  ];
  for (const run of runs)
    rows.push([
      ...(includeSide ? [sideMap[run.id] ?? ""] : []),
      run.id,
      run.category,
      run.dataset.name,
      "euclidean",
      run.dataset.unit,
      run.config.algorithm,
      run.config.initialMethod,
      run.config.improve,
      run.config.improve === "2OPT",
      run.config.startId,
      run.config.seed,
      run.config.maxIterations,
      run.initialCost,
      run.bestCost,
      run.category === "construction"
        ? ""
        : run.initialCost === 0
          ? 0
          : ((run.initialCost - run.bestCost) / run.initialCost) * 100,
      run.iterations,
      run.evaluations,
      run.durations?.constructionMs ?? "",
      run.durations?.preparationMs ?? "",
      run.durations?.searchMs ?? (run.durations ? "" : run.durationMs),
      run.durations?.totalMs ?? "",
      run.status,
      run.stopReason,
      JSON.stringify(run.config),
      closedRoute(run.initialRoute, run.dataset).join(" → "),
      closedRoute(run.bestRoute, run.dataset).join(" → "),
      run.dataset.generator?.seed ?? "",
      run.dataset.generator?.distribution ?? "",
      run.preparedInitialCost ?? "",
      run.preparedInitialRoute
        ? closedRoute(run.preparedInitialRoute, run.dataset).join(" → ")
        : "",
    ]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function exportComparison(
  runs: RunResult[],
  filename = "heurilab-perbandingan.csv",
  sideMap?: Record<string, "A" | "B">,
) {
  download("\ufeff" + comparisonCsv(runs, sideMap), "text/csv;charset=utf-8", filename);
}
