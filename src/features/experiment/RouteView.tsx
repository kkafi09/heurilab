import { useId } from "react";
import { closedRoute, type Dataset, type Route } from "../../domain/tsp/model";
export function RouteView({
  dataset,
  initial,
  current,
  best,
  candidate,
}: {
  dataset: Dataset;
  initial: Route;
  current: Route;
  best: Route;
  candidate?: Route;
}) {
  const id = useId(),
    nodes = dataset.nodes;
  const xs = nodes.map((node) => node.x),
    ys = nodes.map((node) => node.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1),
    spanY = Math.max(maxY - minY, 1),
    scale = Math.min(610 / spanX, 280 / spanY);
  const project = (index: number) => {
    const node = nodes[index]!;
    return {
      x: 360 + (node.x - (minX + (maxX - minX) / 2)) * scale,
      y: 200 - (node.y - (minY + (maxY - minY) / 2)) * scale,
    };
  };
  const path = (route: Route) =>
    [...route, route[0]!]
      .map((node, index) => {
        const p = project(node);
        return `${index ? "L" : "M"}${p.x},${p.y}`;
      })
      .join(" ");
  const layers = [
    { route: initial, color: "#adb7b3", dash: "6 5", width: 2 },
    { route: current, color: "#4e88b5", dash: "9 5", width: 2 },
    { route: candidate, color: "#b27519", dash: "3 5", width: 2 },
    { route: best, color: "#147469", dash: undefined, width: 3 },
  ];
  return (
    <div className="route-map">
      <svg viewBox="0 0 720 400" role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>Visualisasi rute {dataset.name}</title>
        <desc id={`${id}-description`}>
          Rute terbaik: {closedRoute(best, dataset).join(" ke ")}. Posisi mengikuti koordinat; skala
          tampilan tidak mengubah jarak.
        </desc>
        <defs>
          <pattern id={`${id}-grid`} width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#d5ddd7" />
          </pattern>
        </defs>
        <rect width="720" height="400" fill={`url(#${id}-grid)`} />
        {layers.map((layer, index) =>
          layer.route?.length ? (
            <path
              key={index}
              d={path(layer.route)}
              fill="none"
              stroke={layer.color}
              strokeDasharray={layer.dash}
              strokeWidth={layer.width}
              strokeLinejoin="round"
              opacity={index === 3 ? 1 : 0.7}
            />
          ) : null,
        )}
        {nodes.map((node, index) => {
          const p = project(index),
            start = index === initial[0];
          return (
            <g key={node.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={start ? 13 : 9}
                fill={start ? "#e1f2de" : "#fff"}
                stroke="#146b61"
                strokeWidth="2"
              />
              <circle cx={p.x} cy={p.y} r="2.5" fill="#146b61" />
              <text x={p.x} y={p.y - 20} textAnchor="middle" className="node-label">
                {node.id}
              </text>
              <title>
                {node.id}: ({node.x}, {node.y}){start ? " · titik awal" : ""}
              </title>
            </g>
          );
        })}
        <text x="20" y="380" className="map-caption">
          KOORDINAT PLANAR · {nodes.length} NODE
        </text>
      </svg>
      <div className="legend">
        <span>
          <i className="initial" />
          Awal
        </span>
        <span>
          <i className="current" />
          Current
        </span>
        {candidate && (
          <span>
            <i className="candidate" />
            Kandidat
          </span>
        )}
        <span>
          <i className="best" />
          Best
        </span>
        <span className="muted">● Titik awal berlingkar hijau</span>
      </div>
    </div>
  );
}
