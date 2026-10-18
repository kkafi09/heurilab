import { distanceMatrix, type Dataset, type TspNode } from "./model";

export interface ManualInputRowDraft {
  key: string;
  id: string;
  x: string;
  y: string;
}

export interface ManualInputRowIssue {
  key: string;
  field?: "id" | "x" | "y";
  message: string;
}

export interface ManualInputParseResult {
  success: boolean;
  nodes: TspNode[];
  issues: ManualInputRowIssue[];
  generalError?: string;
  firstErrorKey?: string;
  firstErrorField?: "id" | "x" | "y";
  filledRowsCount: number;
  totalAfterAddition: number;
}

/**
 * Generate next available ID using standard HeuriLab pattern:
 * A–Z, then N1, N2, N3...
 */
export function getNextAvailableNodeId(reservedUpper: Set<string>): string {
  for (let i = 0; i < 26; i++) {
    const char = String.fromCharCode(65 + i);
    if (!reservedUpper.has(char)) {
      return char;
    }
  }
  let num = 1;
  while (reservedUpper.has(`N${num}`)) {
    num++;
  }
  return `N${num}`;
}

const FINITE_FLOAT_REGEX = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;

export function parseCoordinate(value: string): { num: number; valid: boolean; empty: boolean } {
  const trimmed = value.trim();
  if (trimmed === "") {
    return { num: NaN, valid: false, empty: true };
  }
  if (!FINITE_FLOAT_REGEX.test(trimmed)) {
    return { num: NaN, valid: false, empty: false };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return { num: NaN, valid: false, empty: false };
  }
  return { num, valid: true, empty: false };
}

/**
 * Parses and validates batch manual node input rows against a base dataset.
 * Batch parsing is atomic: any invalid row or constraint violation rejects the entire batch.
 */
export function parseManualInputDraft(
  rows: ManualInputRowDraft[],
  baseDataset: Dataset,
): ManualInputParseResult {
  const issues: ManualInputRowIssue[] = [];

  // Filter out rows where all fields are completely blank
  const usedRows: Array<{ draft: ManualInputRowDraft; index: number }> = [];
  rows.forEach((draft, index) => {
    const idTrimmed = draft.id.trim();
    const xTrimmed = draft.x.trim();
    const yTrimmed = draft.y.trim();
    if (idTrimmed !== "" || xTrimmed !== "" || yTrimmed !== "") {
      usedRows.push({ draft, index });
    }
  });

  const filledRowsCount = usedRows.length;
  const totalAfterAddition = baseDataset.nodes.length + filledRowsCount;

  if (filledRowsCount === 0) {
    const errorMsg = "Isi minimal satu baris node (koordinat X dan Y wajib diisi).";
    return {
      success: false,
      nodes: [],
      issues: rows.length > 0 ? [{ key: rows[0]!.key, message: errorMsg }] : [],
      generalError: errorMsg,
      firstErrorKey: rows[0]?.key,
      filledRowsCount: 0,
      totalAfterAddition: baseDataset.nodes.length,
    };
  }

  // Check 100 node maximum limit
  if (totalAfterAddition > 100) {
    const errorMsg = `Total node setelah penambahan (${totalAfterAddition}) melebihi batas maksimum 100 node.`;
    issues.push({ key: usedRows[0]!.draft.key, message: errorMsg });
    return {
      success: false,
      nodes: [],
      issues,
      generalError: errorMsg,
      firstErrorKey: usedRows[0]!.draft.key,
      filledRowsCount,
      totalAfterAddition,
    };
  }

  // Sets for tracking IDs
  const existingBaseIds = new Set(baseDataset.nodes.map((n) => n.id.trim()));
  const reservedUpper = new Set(baseDataset.nodes.map((n) => n.id.trim().toUpperCase()));
  const batchExplicitIds = new Set<string>();

  // Pass 1: Reserve all explicit IDs and report any duplicates
  for (const { draft } of usedRows) {
    const idTrimmed = draft.id.trim();
    if (idTrimmed !== "") {
      if (existingBaseIds.has(idTrimmed)) {
        issues.push({
          key: draft.key,
          field: "id",
          message: `ID "${idTrimmed}" sudah digunakan dalam dataset.`,
        });
      } else if (batchExplicitIds.has(idTrimmed)) {
        issues.push({
          key: draft.key,
          field: "id",
          message: `ID "${idTrimmed}" digunakan lebih dari sekali dalam batch.`,
        });
      }
      batchExplicitIds.add(idTrimmed);
      reservedUpper.add(idTrimmed.toUpperCase());
    }
  }

  // Pass 2: Validate coordinates and resolve auto IDs
  const parsedNodes: TspNode[] = [];
  for (const { draft } of usedRows) {
    const idTrimmed = draft.id.trim();
    let assignedId = idTrimmed;

    if (assignedId === "") {
      // Generate automatic ID avoiding all base nodes and all explicit batch IDs
      assignedId = getNextAvailableNodeId(reservedUpper);
      reservedUpper.add(assignedId.toUpperCase());
    }

    const parsedX = parseCoordinate(draft.x);
    if (parsedX.empty) {
      issues.push({
        key: draft.key,
        field: "x",
        message: "Koordinat X wajib diisi.",
      });
    } else if (!parsedX.valid) {
      issues.push({
        key: draft.key,
        field: "x",
        message: "Koordinat X harus berupa angka finite valid (gunakan titik untuk desimal).",
      });
    }

    const parsedY = parseCoordinate(draft.y);
    if (parsedY.empty) {
      issues.push({
        key: draft.key,
        field: "y",
        message: "Koordinat Y wajib diisi.",
      });
    } else if (!parsedY.valid) {
      issues.push({
        key: draft.key,
        field: "y",
        message: "Koordinat Y harus berupa angka finite valid (gunakan titik untuk desimal).",
      });
    }

    if (parsedX.valid && parsedY.valid) {
      parsedNodes.push({
        id: assignedId,
        x: parsedX.num,
        y: parsedY.num,
      });
    }
  }

  // If there are row-level errors, stop before checking distance matrix
  if (issues.length > 0) {
    const firstIssue = issues[0]!;
    return {
      success: false,
      nodes: [],
      issues,
      generalError: issues[0]?.message ?? "Terdapat data yang belum valid pada tabel.",
      firstErrorKey: firstIssue.key,
      firstErrorField: firstIssue.field,
      filledRowsCount,
      totalAfterAddition,
    };
  }

  // Check combined distance matrix / representation limits
  const combined = [...baseDataset.nodes, ...parsedNodes];
  if (combined.length >= 2) {
    const matrix = distanceMatrix(combined);
    const maxEdge = Math.max(...matrix.flat());
    if (!Number.isFinite(maxEdge * combined.length)) {
      const errorMsg = "Koordinat terlalu besar: jarak atau total rute melampaui batas angka.";
      issues.push({
        key: usedRows[0]!.draft.key,
        message: errorMsg,
      });
      return {
        success: false,
        nodes: [],
        issues,
        generalError: errorMsg,
        firstErrorKey: usedRows[0]!.draft.key,
        filledRowsCount,
        totalAfterAddition,
      };
    }
  }

  return {
    success: true,
    nodes: parsedNodes,
    issues: [],
    filledRowsCount,
    totalAfterAddition,
  };
}
