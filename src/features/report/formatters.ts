import { isDatasetIdentical } from "../../domain/tsp/model";
import { EPSILON, type RunResult } from "../../domain/algorithms/experiment";

export { isDatasetIdentical };

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

  const datasetMatches = isDatasetIdentical(target.dataset, reference.dataset);
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
        label: "Dataset, Rute & Batas Iterasi Sama",
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
  return runs.filter((r) => {
    // 1. Dataset wajib identik
    if (!isDatasetIdentical(r.dataset, reference.dataset)) return false;

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
  const datasetRuns = runs.filter(
    (r) => isDatasetIdentical(r.dataset, reference.dataset) && r.status !== "cancelled",
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

  // 3. Durasi terendah dalam kelompok sebanding
  let fastestDuration: ReportKPIData["fastestDuration"] = null;
  if (comparableGroup.length < 2) {
    fastestDuration = {
      valueFormatted: "—",
      subLabel: "Perlu minimal 2 hasil sebanding",
      sampleCount: comparableGroup.length,
      tied: false,
    };
  } else {
    const isMeta = reference.category === "metaheuristic";
    // Untuk metaheuristik: metrik perbandingan utama antara TS-SA adalah waktu pencarian (searchMs)
    // Untuk kategori lain: durasi total terukur (totalMs).
    // Run legacy tanpa durations.totalMs tidak boleh memenangkan KPI total saat ada run dengan total terukur.
    const hasMeasuredTotals = comparableGroup.some(
      (r) => r.durations && typeof r.durations.totalMs === "number" && r.durations.totalMs >= 0,
    );

    const validDurationRuns = comparableGroup.filter((r) => {
      if (isMeta) {
        const ms = r.durations?.searchMs ?? r.durationMs;
        return typeof ms === "number" && Number.isFinite(ms) && ms >= 0;
      }
      if (hasMeasuredTotals) {
        return r.durations && typeof r.durations.totalMs === "number" && r.durations.totalMs >= 0;
      }
      return typeof r.durationMs === "number" && Number.isFinite(r.durationMs) && r.durationMs >= 0;
    });

    if (validDurationRuns.length < 2) {
      fastestDuration = {
        valueFormatted: "—",
        subLabel: isMeta
          ? "Perlu minimal 2 hasil sebanding"
          : hasMeasuredTotals
            ? "Perlu minimal 2 hasil dengan durasi total terukur"
            : "Durasi fase tidak lengkap",
        sampleCount: validDurationRuns.length,
        tied: false,
      };
    } else {
      const getMs = (r: RunResult) => {
        if (isMeta) return r.durations?.searchMs ?? r.durationMs;
        if (hasMeasuredTotals) return r.durations!.totalMs;
        return r.durationMs;
      };

      let minMs = Infinity;
      for (const r of validDurationRuns) {
        const ms = getMs(r);
        if (ms < minMs) minMs = ms;
      }
      const tiedDurations = validDurationRuns.filter((r) => {
        const ms = getMs(r);
        return Math.abs(ms - minMs) < 0.1;
      });

      fastestDuration = {
        valueFormatted: formatDuration(minMs),
        subLabel:
          tiedDurations.length > 1
            ? `Setara pada ${tiedDurations.length} run sebanding`
            : isMeta
              ? `Pencarian terendah dari ${validDurationRuns.length} run sebanding`
              : `Durasi total terendah dari ${validDurationRuns.length} run sebanding`,
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

/**
 * Identitas terpadu run yang stabil di seluruh Report.
 */
export function getRunIdentity(
  run: RunResult,
  runs: RunResult[],
): {
  runNumber: number;
  shortId: string;
  methodName: string;
  fullLabel: string;
} {
  const idx = runs.findIndex((r) => r.id === run.id);
  const runNumber = idx >= 0 ? runs.length - idx : 1;
  const shortId = run.id.slice(0, 6);
  const methodName = getMethodDisplayName(run);
  return {
    runNumber,
    shortId,
    methodName,
    fullLabel: `Run #${runNumber} · ${methodName} (#${shortId})`,
  };
}

export interface PairComparability {
  isComparable: boolean;
  statusType:
    | "comparable"
    | "different_route"
    | "different_dataset"
    | "different_iterations"
    | "different_start"
    | "cross_category"
    | "partial";
  headline: string;
  badgeText: string;
  badgeVariant: "success" | "warning" | "info" | "neutral";
  details: string[];
  maxIterationsNote?: string;
  cancelledWarning?: string;
}

/**
 * Evaluasi mendalam kesebandingan pasangan dua hasil (Hasil A vs Hasil B).
 */
export function evaluatePairComparability(runA: RunResult, runB: RunResult): PairComparability {
  const isCancelledA = runA.status === "cancelled";
  const isCancelledB = runB.status === "cancelled";
  const cancelledWarning =
    isCancelledA || isCancelledB
      ? `Hasil Parsial: Salah satu atau kedua run dibatalkan sebelum selesai (A: ${
          isCancelledA ? (runA.cancelledStage ?? "batal") : "selesai"
        }, B: ${
          isCancelledB ? (runB.cancelledStage ?? "batal") : "selesai"
        }). Anggaran komputasi tidak setara.`
      : undefined;

  // Deep dataset comparison: node count, unit, IDs, and coordinates
  const sameDataset = isDatasetIdentical(runA.dataset, runB.dataset);

  if (!sameDataset) {
    return {
      isComparable: false,
      statusType: "different_dataset",
      headline: "Dataset Berbeda",
      badgeText: "Beda Dataset",
      badgeVariant: "warning",
      details: [
        `Dataset "${runA.dataset.name}" dan "${runB.dataset.name}" memiliki koordinat atau himpunan titik berbeda. Skala jarak tidak ekuivalen.`,
      ],
      cancelledWarning,
    };
  }

  // Case 1: Construction vs Construction
  if (runA.category === "construction" && runB.category === "construction") {
    const sameStart = runA.config.startId === runB.config.startId;
    if (sameStart) {
      return {
        isComparable: true,
        statusType: "comparable",
        headline: "Sebanding (Dataset & Titik Awal Sama)",
        badgeText: "Sebanding",
        badgeVariant: "success",
        details: [
          `Kedua metode konstruksi berangkat dari titik awal yang sama (Node ${runA.config.startId}).`,
          "Rute konstruksi berbeda karena masing-masing heuristik menerapkan aturan pemilihan dan penambahan simpul yang berlainan.",
        ],
        cancelledWarning,
      };
    }
    return {
      isComparable: false,
      statusType: "different_start",
      headline: "Titik Awal Konstruksi Berbeda",
      badgeText: "Beda Titik Awal",
      badgeVariant: "warning",
      details: [
        `Titik awal berbeda (Node ${runA.config.startId} vs Node ${runB.config.startId}). Perbedaan jarak akhir dipengaruhi pemilihan titik awal.`,
      ],
      cancelledWarning,
    };
  }

  // Case 2: Local Search vs Local Search
  if (runA.category === "local-search" && runB.category === "local-search") {
    const sameRoute = areRoutesIdentical(runA.initialRoute, runB.initialRoute);
    if (sameRoute) {
      return {
        isComparable: true,
        statusType: "comparable",
        headline: "Sebanding (Dataset & Rute Masukan Identik)",
        badgeText: "Sebanding",
        badgeVariant: "success",
        details: [
          "Kedua algoritma pencarian lokal berangkat dari tur masukan yang persis sama.",
          "Perbedaan hasil akhir semata-mata berasal dari kemampuan perbaikan neighborhood (2-OPT vs 3-OPT).",
        ],
        cancelledWarning,
      };
    }
    return {
      isComparable: false,
      statusType: "different_route",
      headline: "Rute Masukan Berbeda",
      badgeText: "Beda Rute Masukan",
      badgeVariant: "warning",
      details: [
        "Tur masukan sebelum perbaikan lokal tidak identik. Performa akhir dipengaruhi kualitas rute awal.",
      ],
      cancelledWarning,
    };
  }

  // Case 3: Metaheuristic vs Metaheuristic
  if (runA.category === "metaheuristic" && runB.category === "metaheuristic") {
    const sameRoute = areRoutesIdentical(runA.initialRoute, runB.initialRoute);
    const sameMaxIter = runA.config.maxIterations === runB.config.maxIterations;

    if (sameRoute && sameMaxIter) {
      const details = [
        "Dataset dan rute solusi awal identik.",
        `Batas iterasi maksimum sama: ${runA.config.maxIterations.toLocaleString("id-ID")} iterasi.`,
      ];
      if (runA.iterations !== runB.iterations) {
        details.push(
          `Iterasi aktual berbeda (${runA.iterations.toLocaleString("id-ID")} vs ${runB.iterations.toLocaleString("id-ID")}) karena kriteria berhenti tercapai lebih awal (${runA.stopReason} vs ${runB.stopReason}).`,
        );
      }
      details.push(
        `Parameter spesifik algoritma (${runA.config.algorithm === "TS" ? `Tabu tenure ${runA.config.tenure}` : `T₀=${runA.config.initialTemperature}, α=${runA.config.coolingRate}`} vs ${runB.config.algorithm === "TS" ? `Tabu tenure ${runB.config.tenure}` : `T₀=${runB.config.initialTemperature}, α=${runB.config.coolingRate}`}) tetap berlaku sesuai metode masing-masing.`,
      );

      return {
        isComparable: true,
        statusType: "comparable",
        headline: "Sebanding (Dataset, Rute Awal & Batas Iterasi Identik)",
        badgeText: "Sebanding",
        badgeVariant: "success",
        details,
        maxIterationsNote: `Batas iterasi maksimum sama (${runA.config.maxIterations.toLocaleString("id-ID")})`,
        cancelledWarning,
      };
    }

    if (sameRoute && !sameMaxIter) {
      return {
        isComparable: false,
        statusType: "different_iterations",
        headline: "Batas Iterasi Berbeda",
        badgeText: "Beda Batas Iterasi",
        badgeVariant: "warning",
        details: [
          `Rute awal identik, namun batas iterasi maksimum berbeda (${runA.config.maxIterations.toLocaleString("id-ID")} vs ${runB.config.maxIterations.toLocaleString("id-ID")}). Alokasi anggaran komputasi tidak seimbang.`,
        ],
        cancelledWarning,
      };
    }

    return {
      isComparable: false,
      statusType: "different_route",
      headline: "Rute Solusi Awal Berbeda",
      badgeText: "Beda Rute Awal",
      badgeVariant: "warning",
      details: [
        "Solusi awal yang diumpankan ke metaheuristik berbeda urutan. Perbandingan terdistorsi oleh perbedaan kualitas awal.",
      ],
      cancelledWarning,
    };
  }

  // Case 4: Cross Category
  return {
    isComparable: false,
    statusType: "cross_category",
    headline: "Perbandingan Bersifat Deskriptif",
    badgeText: "Lintas Kategori",
    badgeVariant: "info",
    details: [
      `Metode berasal dari kategori berbeda (${runA.category} vs ${runB.category}) dengan mekanisme komputasi yang tidak setara (misal konstruksi langsung 1 lintasan vs pencarian iteratif).`,
    ],
    cancelledWarning,
  };
}
