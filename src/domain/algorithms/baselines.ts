import { EPSILON, routeCost, type DistanceMatrix, type Route, type TspNode } from "../tsp/model";

export interface Move {
  i: number;
  j: number;
}
export function twoOptMoves(size: number): Move[] {
  const moves: Move[] = [];
  for (let i = 0; i < size - 2; i++)
    for (let j = i + 2; j < size; j++) {
      if (i === 0 && j === size - 1) continue;
      moves.push({ i, j });
    }
  return moves;
}
export function applyMove(route: Route, { i, j }: Move): Route {
  return [
    ...route.slice(0, i + 1),
    ...route.slice(i + 1, j + 1).toReversed(),
    ...route.slice(j + 1),
  ];
}
export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
export function moveEdges(route: Route, { i, j }: Move) {
  const a = route[i]!,
    b = route[i + 1]!,
    c = route[j]!,
    d = route[(j + 1) % route.length]!;
  return { removed: [edgeKey(a, b), edgeKey(c, d)], added: [edgeKey(a, c), edgeKey(b, d)] };
}
export function moveDelta(route: Route, { i, j }: Move, matrix: DistanceMatrix): number {
  const a = route[i]!,
    b = route[i + 1]!,
    c = route[j]!,
    d = route[(j + 1) % route.length]!;
  return matrix[a]![c]! + matrix[b]![d]! - matrix[a]![b]! - matrix[c]![d]!;
}
function compareId(a: TspNode, b: TspNode): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
function nearest(unvisited: number[], distance: (i: number) => number, nodes: TspNode[]): number {
  return unvisited.toSorted((a, b) => {
    const delta = distance(a) - distance(b);
    return Math.abs(delta) > EPSILON ? delta : compareId(nodes[a]!, nodes[b]!);
  })[0]!;
}
export function nearestNeighbor(nodes: TspNode[], matrix: DistanceMatrix, start: number): Route {
  const route = [start];
  const remaining = nodes.map((_, i) => i).filter((i) => i !== start);
  while (remaining.length) {
    const next = nearest(remaining, (i) => matrix[route.at(-1)!]![i]!, nodes);
    route.push(next);
    remaining.splice(remaining.indexOf(next), 1);
  }
  return route;
}
export function nearestInsertion(nodes: TspNode[], matrix: DistanceMatrix, start: number): Route {
  const remaining = nodes.map((_, i) => i).filter((i) => i !== start);
  const second = nearest(remaining, (i) => matrix[start]![i]!, nodes);
  const route = [start, second];
  remaining.splice(remaining.indexOf(second), 1);
  while (remaining.length) {
    const next = nearest(remaining, (i) => Math.min(...route.map((j) => matrix[i]![j]!)), nodes);
    let position = 0,
      best = Infinity;
    for (let i = 0; i < route.length; i++) {
      const a = route[i]!,
        b = route[(i + 1) % route.length]!;
      const delta = matrix[a]![next]! + matrix[next]![b]! - matrix[a]![b]!;
      if (delta < best - EPSILON) {
        best = delta;
        position = i + 1;
      }
    }
    route.splice(position, 0, next);
    remaining.splice(remaining.indexOf(next), 1);
  }
  return route;
}
export function twoOptDescent(initial: Route, matrix: DistanceMatrix, maxMoves = 10000): Route {
  let route = [...initial];
  const moves = twoOptMoves(route.length);
  for (let iteration = 0; iteration < maxMoves; iteration++) {
    let best: Move | undefined,
      bestDelta = -EPSILON;
    for (const move of moves) {
      const delta = moveDelta(route, move, matrix);
      if (delta < bestDelta) {
        best = move;
        bestDelta = delta;
      }
    }
    if (!best) break;
    const candidate = applyMove(route, best);
    if (routeCost(candidate, matrix) >= routeCost(route, matrix) - EPSILON) break;
    route = candidate;
  }
  return route;
}
