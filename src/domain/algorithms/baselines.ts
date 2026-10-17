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
  return twoOptDescentDetailed(initial, matrix, maxMoves).route;
}

export function nearestFarthestInsertion(
  nodes: TspNode[],
  matrix: DistanceMatrix,
  start: number,
): Route {
  const remaining = nodes.map((_, i) => i).filter((i) => i !== start);
  const second = nearest(remaining, (i) => matrix[start]![i]!, nodes);
  const route = [start, second];
  remaining.splice(remaining.indexOf(second), 1);
  while (remaining.length) {
    const next = remaining.toSorted((a, b) => {
      const distA = Math.min(...route.map((j) => matrix[a]![j]!));
      const distB = Math.min(...route.map((j) => matrix[b]![j]!));
      const delta = distB - distA; // Descending: furthest node from current tour
      return Math.abs(delta) > EPSILON ? delta : compareId(nodes[a]!, nodes[b]!);
    })[0]!;
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

export type ThreeOptCase = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ThreeOptMove {
  i: number;
  j: number;
  k: number;
  caseType: ThreeOptCase;
}

export function threeOptTriples(size: number): [number, number, number][] {
  const triples: [number, number, number][] = [];
  if (size < 6) return triples;
  for (let i = 0; i < size - 4; i++) {
    for (let j = i + 2; j < size - 2; j++) {
      for (let k = j + 2; k < size; k++) {
        if (i === 0 && k === size - 1) continue;
        triples.push([i, j, k]);
      }
    }
  }
  return triples;
}

export function applyThreeOptMove(route: Route, move: ThreeOptMove): Route {
  const { i, j, k, caseType } = move;
  const A = route.slice(0, i + 1);
  const B = route.slice(i + 1, j + 1);
  const C = route.slice(j + 1, k + 1);
  const D = route.slice(k + 1);

  switch (caseType) {
    case 1:
      return [...A, ...B.toReversed(), ...C, ...D];
    case 2:
      return [...A, ...B, ...C.toReversed(), ...D];
    case 3:
      return [...A, ...C.toReversed(), ...B.toReversed(), ...D];
    case 4:
      return [...A, ...B.toReversed(), ...C.toReversed(), ...D];
    case 5:
      return [...A, ...C, ...B, ...D];
    case 6:
      return [...A, ...C, ...B.toReversed(), ...D];
    case 7:
      return [...A, ...C.toReversed(), ...B, ...D];
  }
}

export function threeOptDelta(route: Route, move: ThreeOptMove, matrix: DistanceMatrix): number {
  const { i, j, k, caseType } = move;
  const n = route.length;
  const a = route[i]!,
    b = route[i + 1]!,
    c = route[j]!,
    d = route[j + 1]!,
    e = route[k]!,
    f = route[(k + 1) % n]!;

  switch (caseType) {
    case 1:
      return matrix[a]![c]! + matrix[b]![d]! - matrix[a]![b]! - matrix[c]![d]!;
    case 2:
      return matrix[c]![e]! + matrix[d]![f]! - matrix[c]![d]! - matrix[e]![f]!;
    case 3:
      return matrix[a]![e]! + matrix[b]![f]! - matrix[a]![b]! - matrix[e]![f]!;
    case 4:
      return (
        matrix[a]![c]! +
        matrix[b]![e]! +
        matrix[d]![f]! -
        (matrix[a]![b]! + matrix[c]![d]! + matrix[e]![f]!)
      );
    case 5:
      return (
        matrix[a]![d]! +
        matrix[e]![b]! +
        matrix[c]![f]! -
        (matrix[a]![b]! + matrix[c]![d]! + matrix[e]![f]!)
      );
    case 6:
      return (
        matrix[a]![d]! +
        matrix[e]![c]! +
        matrix[b]![f]! -
        (matrix[a]![b]! + matrix[c]![d]! + matrix[e]![f]!)
      );
    case 7:
      return (
        matrix[a]![e]! +
        matrix[d]![b]! +
        matrix[c]![f]! -
        (matrix[a]![b]! + matrix[c]![d]! + matrix[e]![f]!)
      );
  }
}

export interface LocalSearchResult {
  route: Route;
  cost: number;
  initialCost: number;
  steps: number;
  evaluations: number;
  stopReason: "no-improvement" | "step-limit" | "empty-neighborhood" | "cancelled";
}

export function twoOptDescentDetailed(
  initial: Route,
  matrix: DistanceMatrix,
  maxMoves = 10000,
): LocalSearchResult {
  let route = [...initial];
  const initialCost = routeCost(route, matrix);
  let cost = initialCost;
  const moves = twoOptMoves(route.length);
  if (!moves.length) {
    return {
      route,
      cost,
      initialCost,
      steps: 0,
      evaluations: 0,
      stopReason: "empty-neighborhood",
    };
  }
  let steps = 0;
  let evaluations = 0;

  for (let iteration = 0; iteration < maxMoves; iteration++) {
    let best: Move | undefined;
    let bestDelta = -EPSILON;
    for (const move of moves) {
      evaluations++;
      const delta = moveDelta(route, move, matrix);
      if (delta < bestDelta) {
        best = move;
        bestDelta = delta;
      }
    }
    if (!best) {
      return { route, cost, initialCost, steps, evaluations, stopReason: "no-improvement" };
    }
    const candidate = applyMove(route, best);
    const candidateCost = routeCost(candidate, matrix);
    if (candidateCost >= cost - EPSILON) {
      return { route, cost, initialCost, steps, evaluations, stopReason: "no-improvement" };
    }
    route = candidate;
    cost = candidateCost;
    steps++;
  }
  return { route, cost, initialCost, steps, evaluations, stopReason: "step-limit" };
}

export function threeOptDescentDetailed(
  initial: Route,
  matrix: DistanceMatrix,
  maxMoves = 10000,
): LocalSearchResult {
  let route = [...initial];
  const initialCost = routeCost(route, matrix);
  let cost = initialCost;
  const triples = threeOptTriples(route.length);
  if (!triples.length) {
    return {
      route,
      cost,
      initialCost,
      steps: 0,
      evaluations: 0,
      stopReason: "empty-neighborhood",
    };
  }
  let steps = 0;
  let evaluations = 0;

  for (let iteration = 0; iteration < maxMoves; iteration++) {
    let bestMove: ThreeOptMove | undefined;
    let bestDelta = -EPSILON;

    for (const [i, j, k] of triples) {
      for (let caseType = 1; caseType <= 7; caseType++) {
        evaluations++;
        const delta = threeOptDelta(route, { i, j, k, caseType: caseType as ThreeOptCase }, matrix);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestMove = { i, j, k, caseType: caseType as ThreeOptCase };
        }
      }
    }

    if (!bestMove) {
      return { route, cost, initialCost, steps, evaluations, stopReason: "no-improvement" };
    }

    const candidate = applyThreeOptMove(route, bestMove);
    const candidateCost = routeCost(candidate, matrix);
    if (candidateCost >= cost - EPSILON) {
      return { route, cost, initialCost, steps, evaluations, stopReason: "no-improvement" };
    }
    route = candidate;
    cost = candidateCost;
    steps++;
  }
  return { route, cost, initialCost, steps, evaluations, stopReason: "step-limit" };
}

export function threeOptDescent(initial: Route, matrix: DistanceMatrix, maxMoves = 10000): Route {
  return threeOptDescentDetailed(initial, matrix, maxMoves).route;
}
