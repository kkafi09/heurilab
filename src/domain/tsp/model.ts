import example from "../../../data/example-six.json";

export interface TspNode {
  id: string;
  x: number;
  y: number;
}
export interface Dataset {
  id: string;
  name: string;
  nodes: TspNode[];
  unit: string;
  provenance: string;
}
export type Route = number[];
export type DistanceMatrix = number[][];
export interface ValidationIssue {
  row?: number;
  field?: string;
  message: string;
}
export const EPSILON = 1e-9;
export const EXAMPLE: Dataset = example;

export function distanceMatrix(nodes: TspNode[]): DistanceMatrix {
  return nodes.map((a) => nodes.map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
}
export function validateDataset(dataset: Dataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (dataset.nodes.length < 3 || dataset.nodes.length > 100)
    issues.push({ message: "Dataset harus berisi 3–100 node." });
  const ids = new Set<string>();
  dataset.nodes.forEach((node, row) => {
    if (!node.id.trim()) issues.push({ row, field: "id", message: "ID wajib diisi." });
    else if (ids.has(node.id.trim()))
      issues.push({ row, field: "id", message: `ID ${node.id} digunakan lebih dari sekali.` });
    ids.add(node.id.trim());
    for (const field of ["x", "y"] as const)
      if (!Number.isFinite(node[field]))
        issues.push({ row, field, message: `Koordinat ${field} harus berupa angka finite.` });
  });
  if (!issues.length) {
    const matrix = distanceMatrix(dataset.nodes);
    // Bound every possible tour, including intermediate candidate tours.
    const maxEdge = Math.max(...matrix.flat());
    if (!Number.isFinite(maxEdge * dataset.nodes.length))
      issues.push({
        message: "Koordinat terlalu besar: jarak atau total rute melampaui batas angka.",
      });
  }
  return issues;
}
export function validateRoute(route: Route, size: number): boolean {
  return (
    route.length === size &&
    new Set(route).size === size &&
    route.every((i) => Number.isInteger(i) && i >= 0 && i < size)
  );
}
export function routeCost(route: Route, matrix: DistanceMatrix): number {
  if (!validateRoute(route, matrix.length))
    throw new Error("Rute harus memuat setiap node tepat sekali.");
  return route.reduce((sum, node, i) => sum + matrix[node]![route[(i + 1) % route.length]!]!, 0);
}
export function closedRoute(route: Route, dataset: Dataset): string[] {
  return [...route, route[0]!].map((i) => dataset.nodes[i]!.id);
}
export function datasetKey(dataset: Dataset): string {
  return JSON.stringify({ nodes: dataset.nodes, unit: dataset.unit, distance: "euclidean" });
}

export function isDatasetIdentical(a: Dataset, b: Dataset): boolean {
  if (a === b) return true;
  if (a.unit !== b.unit) return false;
  if (a.nodes.length !== b.nodes.length) return false;
  return a.nodes.every((nA, i) => {
    const nB = b.nodes[i];
    return (
      nB !== undefined &&
      nA.id === nB.id &&
      Math.abs(nA.x - nB.x) < 1e-9 &&
      Math.abs(nA.y - nB.y) < 1e-9
    );
  });
}
