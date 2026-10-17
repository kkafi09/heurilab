import { datasetKey } from "../../domain/tsp/model";
import { EPSILON, type RunResult } from "../../domain/algorithms/experiment";

/**
 * Format jarak biaya rute dalam locale id-ID dengan 3 angka desimal.
 */
export function formatDistance(cost: number | undefined | null): string {
  if (cost === undefined || cost === null || !Number.isFinite(cost)) {
    return "—";
  }
  return cost.toLocaleString("id-ID", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/**
 * Format persentase perbaikan dengan 2 angka desimal dan koma bahasa Indonesia.
 */
export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "—";
  }
  return (
    value.toLocaleString("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + "%"
  );
}

/**
 * Format durasi waktu eksekusi:
 * - 0–999 ms: dalam milidetik (ms) dengan maksimal satu desimal.
 * - ≥1.000 ms: dalam detik (s) dengan 2 angka desimal.
 * - Positif < 0,1 ms: "<0,1 ms"
 * - Nol terukur: "0 ms"
 * - Tidak tersedia: "—"
 */
export function formatDuration(ms: number | undefined | null): string {
  if (ms === undefined || ms === null || !Number.isFinite(ms) || ms < 0) {
    return "—";
  }
  if (ms === 0) {
    return "0 ms";
  }
  if (ms < 0.1) {
    return "<0,1 ms";
  }
  if (ms < 1000) {
    const roundedOne = Math.round(ms * 10) / 10;
    const formatted = Number.isInteger(roundedOne)
      ? roundedOne.toString()
      : roundedOne.toFixed(1).replace(".", ",");
    return `${formatted} ms`;
  }
  return `${(ms / 1000).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}s`;
}

/**
 * Format breakdown fase durasi komputasi dengan label lengkap.
 */
export function formatStageBreakdown(run: RunResult): {
  totalFormatted: string;
  parts: { label: string; ms: number; formatted: string }[];
  summary: string | null;
} {
  const d = run.durations;
  const totalMs = d?.totalMs ?? run.durationMs;
  const totalFormatted = formatDuration(totalMs);

  if (!d) {
    return {
      totalFormatted,
      parts: [],
      summary: null,
    };
  }

  const parts: { label: string; ms: number; formatted: string }[] = [];
  if (d.constructionMs !== undefined && d.constructionMs >= 0) {
    parts.push({
      label: "Konstruksi",
      ms: d.constructionMs,
      formatted: formatDuration(d.constructionMs),
    });
  }
  if (d.preparationMs !== undefined && d.preparationMs > 0) {
    parts.push({
      label: "Persiapan",
      ms: d.preparationMs,
      formatted: formatDuration(d.preparationMs),
    });
  }
  if (d.searchMs !== undefined && d.searchMs >= 0) {
    parts.push({
      label: "Pencarian",
      ms: d.searchMs,
      formatted: formatDuration(d.searchMs),
    });
  }

  const summary =
    parts.length > 0
      ? parts
          .map((p) => {
            const code = p.label === "Konstruksi" ? "K" : p.label === "Persiapan" ? "P" : "S";
            return `${code}: ${p.formatted}`;
          })
          .join(" · ")
      : null;

  return {
    totalFormatted,
    parts,
    summary,
  };
}

/**
 * Nama tampilan terpusat dan konsisten untuk metode pada UI.
 */
export function getMethodDisplayName(run: RunResult): string {
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

/**
 * Label singkat untuk kartu riwayat dan chip.
 */
export function getMethodShortLabel(run: RunResult): string {
  if (run.category === "construction") {
    return run.config.initialMethod;
  }
  if (run.category === "local-search") {
    return run.config.algorithm === "3OPT" || run.config.improve === "3OPT" ? "3-OPT" : "2-OPT";
  }
  return run.config.algorithm;
}

/**
 * Periksa apakah dua rute tour memiliki urutan simpul yang sama.
 */
export function areRoutesIdentical(r1: readonly number[], r2: readonly number[]): boolean {
  if (r1.length !== r2.length) return false;
  for (let i = 0; i < r1.length; i++) {
    if (r1[i] !== r2[i]) return false;
  }
  return true;
}

/**
 * Evaluasi status kondisi perbandingan antara suatu hasil dengan hasil acuan (reference).
 */
export function evaluateComparisonCondition(
  target: RunResult,
  reference: RunResult | null,
): {
  label: string;
  className: "same" | "different" | "neutral";
  tooltip: string;
} {
  if (!reference || target.id === reference.id) {
    return {
      label: "Acuan",
      className: "same",
      tooltip: "Run ini adalah acuan perbandingan aktif.",
    };
  }

  const datasetMatches = datasetKey(target.dataset) === datasetKey(reference.dataset);
  if (!datasetMatches) {
    return {
      label: "Dataset Berbeda",
      className: "different",
      tooltip: "Dataset atau definisi koordinat berbeda dari acuan.",
    };
  }

  const routeMatches = areRoutesIdentical(target.initialRoute, reference.initialRoute);

  // Keduanya adalah Local Search
  if (target.category === "local-search" && reference.category === "local-search") {
    if (routeMatches) {
      return {
        label: "Dataset & Rute Awal Sama",
        className: "same",
        tooltip: "Dataset dan rute masukan awal identik dengan acuan.",
      };
    }
    return {
      label: "Dataset Sama (Beda Rute)",
      className: "different",
      tooltip: "Dataset sama, tetapi rute masukan awal berbeda dari acuan.",
    };
  }

  // Keduanya adalah Metaheuristik
  if (target.category === "metaheuristic" && reference.category === "metaheuristic") {
    const iterMatches = target.config.maxIterations === reference.config.maxIterations;
    if (routeMatches && iterMatches) {
      return {
        label: "Dataset, Rute & Iterasi Sama",
        className: "same",
        tooltip: "Dataset, rute awal, dan batas iterasi identik dengan acuan.",
      };
    }
    if (routeMatches) {
      return {
        label: "Dataset & Rute Sama (Beda Iterasi)",
        className: "different",
        tooltip: `Dataset dan rute sama, namun batas iterasi berbeda (${target.config.maxIterations} vs ${reference.config.maxIterations}).`,
      };
    }
    return {
      label: "Dataset Sama (Beda Rute)",
      className: "different",
      tooltip: "Dataset sama, tetapi rute awal berbeda.",
    };
  }

  // Lintas kategori pada dataset yang sama
  if (routeMatches) {
    return {
      label: "Dataset & Rute Awal Sama",
      className: "neutral",
      tooltip: "Dataset dan rute awal sama, kategori metode berbeda.",
    };
  }

  return {
    label: "Dataset Sama",
    className: "neutral",
    tooltip: "Dataset sama dari segi koordinat dan unit.",
  };
}

/**
 * Filter run yang benar-benar sebanding dengan run acuan untuk perhitungan statistik agregat.
 */
export function getComparableRuns(runs: RunResult[], reference: RunResult): RunResult[] {
  const refKey = datasetKey(reference.dataset);
  return runs.filter((r) => {
    // 1. Dataset wajib identik
    if (datasetKey(r.dataset) !== refKey) return false;

    // 2. Kategori wajib sama
    if (r.category !== reference.category) return false;

    // 3. Local Search: rute awal wajib identik
    if (r.category === "local-search") {
      return areRoutesIdentical(r.initialRoute, reference.initialRoute);
    }

    // 4. Metaheuristik: rute awal dan batas iterasi wajib identik
    if (r.category === "metaheuristic") {
      return (
        areRoutesIdentical(r.initialRoute, reference.initialRoute) &&
        r.config.maxIterations === reference.config.maxIterations
      );
    }

    // 5. Konstruksi: tidak digabung dalam perbaikan
    return false;
  });
}

export interface ReportKPIData {
  bestDistance: {
    valueFormatted: string;
    isTie: boolean;
    tiedCount: number;
    methodsLabel: string;
    subLabel: string;
  } | null;
  avgImprovement: {
    valueFormatted: string;
    subLabel: string;
    sampleCount: number;
  } | null;
  fastestDuration: {
    valueFormatted: string;
    subLabel: string;
    sampleCount: number;
    tied: boolean;
  } | null;
  totalRuns: {
    count: number;
    subLabel: string;
  };
}

/**
 * Kalkulasi KPI Laporan secara terstruktur, deterministik, dan adil.
 */
export function calculateReportKPIs(runs: RunResult[], reference: RunResult | null): ReportKPIData {
  const totalRuns = {
    count: runs.length,
    subLabel: "Tersimpan dalam sesi aktif",
  };

  if (!reference || runs.length === 0) {
    return {
      bestDistance: null,
      avgImprovement: null,
      fastestDuration: null,
      totalRuns,
    };
  }

  // 1. Jarak terendah pada dataset acuan (hanya run pada dataset yang sama)
  const refDatasetKey = datasetKey(reference.dataset);
  const datasetRuns = runs.filter(
    (r) => datasetKey(r.dataset) === refDatasetKey && r.status !== "cancelled",
  );

  let bestDistance: ReportKPIData["bestDistance"] = null;
  if (datasetRuns.length > 0) {
    let minCost = Infinity;
    for (const r of datasetRuns) {
      if (r.bestCost < minCost) {
        minCost = r.bestCost;
      }
    }

    // Cari semua run yang jaraknya sama dalam toleransi EPSILON
    const tiedRuns = datasetRuns.filter((r) => Math.abs(r.bestCost - minCost) <= EPSILON);
    const isTie = tiedRuns.length > 1;

    const uniqueMethods = Array.from(new Set(tiedRuns.map((r) => getMethodShortLabel(r))));
    const methodsLabel = isTie
      ? `Seri · ${tiedRuns.length} hasil (${uniqueMethods.join(", ")})`
      : getMethodDisplayName(tiedRuns[0]!);

    bestDistance = {
      valueFormatted: formatDistance(minCost),
      isTie,
      tiedCount: tiedRuns.length,
      methodsLabel,
      subLabel: `Jarak terendah pada dataset ${reference.dataset.name}`,
    };
  }

  // 2. Rata-rata perbaikan kelompok sebanding
  const comparableGroup = getComparableRuns(runs, reference).filter(
    (r) => r.status !== "cancelled",
  );

  let avgImprovement: ReportKPIData["avgImprovement"] = null;
  if (reference.category === "construction") {
    avgImprovement = {
      valueFormatted: "—",
      subLabel: "Metode konstruksi tidak memiliki perbaikan",
      sampleCount: 0,
    };
  } else if (comparableGroup.length < 2) {
    avgImprovement = {
      valueFormatted: "—",
      subLabel: "Perlu minimal 2 hasil sebanding",
      sampleCount: comparableGroup.length,
    };
  } else {
    const totalImpr = comparableGroup.reduce((acc, r) => {
      const imp = r.initialCost === 0 ? 0 : ((r.initialCost - r.bestCost) / r.initialCost) * 100;
      return acc + imp;
    }, 0);
    const avg = totalImpr / comparableGroup.length;
    avgImprovement = {
      valueFormatted: formatPercent(avg),
      subLabel: `Rata-rata dari ${comparableGroup.length} run sebanding`,
      sampleCount: comparableGroup.length,
    };
  }

  // 3. Durasi total terendah dalam kelompok sebanding
  let fastestDuration: ReportKPIData["fastestDuration"] = null;
  if (comparableGroup.length < 2) {
    fastestDuration = {
      valueFormatted: "—",
      subLabel: "Perlu minimal 2 hasil sebanding",
      sampleCount: comparableGroup.length,
      tied: false,
    };
  } else {
    const validDurationRuns = comparableGroup.filter(
      (r) => (r.durations?.totalMs ?? r.durationMs) >= 0,
    );
    if (validDurationRuns.length < 2) {
      fastestDuration = {
        valueFormatted: "—",
        subLabel: "Durasi fase tidak lengkap",
        sampleCount: validDurationRuns.length,
        tied: false,
      };
    } else {
      let minMs = Infinity;
      for (const r of validDurationRuns) {
        const ms = r.durations?.totalMs ?? r.durationMs;
        if (ms < minMs) minMs = ms;
      }
      const tiedDurations = validDurationRuns.filter((r) => {
        const ms = r.durations?.totalMs ?? r.durationMs;
        return Math.abs(ms - minMs) < 0.1;
      });

      fastestDuration = {
        valueFormatted: formatDuration(minMs),
        subLabel:
          tiedDurations.length > 1
            ? `Setara pada ${tiedDurations.length} run sebanding`
            : `Durasi terendah dari ${validDurationRuns.length} run sebanding`,
        sampleCount: validDurationRuns.length,
        tied: tiedDurations.length > 1,
      };
    }
  }

  return {
    bestDistance,
    avgImprovement,
    fastestDuration,
    totalRuns,
  };
}
