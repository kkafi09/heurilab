import { useId, useRef, useState, useMemo } from "react";
import {
  MousePointer,
  PlusCircle,
  Shuffle,
  RotateCcw,
  Upload,
  Trash2,
  Flag,
  X,
  HelpCircle,
  FileSpreadsheet,
} from "lucide-react";
import { closedRoute, type Dataset, type Route } from "../../domain/tsp/model";
import { Button } from "../../components/ui";
import { ImportPanel } from "../dataset/ImportPanel";

export function InteractiveCanvas({
  dataset,
  initial,
  current,
  best,
  candidate,
  startId,
  onAddNode,
  onMoveNode,
  onRemoveNode,
  onClearNodes,
  onRandomNodes,
  onLoadExample,
  onSetStartId,
  onUploadDataset,
  busy,
  phase,
}: {
  dataset: Dataset;
  initial: Route;
  current: Route;
  best: Route;
  candidate?: Route;
  startId: string;
  onAddNode: (x: number, y: number) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onRemoveNode: (id: string) => void;
  onClearNodes: () => void;
  onRandomNodes: (count: number) => void;
  onLoadExample: () => void;
  onSetStartId: (id: string) => void;
  onUploadDataset: (dataset: Dataset) => void;
  busy: boolean;
  phase: string;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [tool, setTool] = useState<"select" | "add">("select");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const nodes = dataset.nodes;

  // Calculation of planar bounds and center
  const { midX, midY, scale } = useMemo(() => {
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = xs.length ? Math.min(...xs) : -10;
    const maxX = xs.length ? Math.max(...xs) : 10;
    const minY = ys.length ? Math.min(...ys) : -10;
    const maxY = ys.length ? Math.max(...ys) : 10;
    const computedMidX = (minX + maxX) / 2;
    const computedMidY = (minY + maxY) / 2;
    const effectiveSpanX = Math.max(maxX - minX, 14);
    const effectiveSpanY = Math.max(maxY - minY, 9);
    const computedScale = Math.min(740 / effectiveSpanX, 390 / effectiveSpanY);
    return { midX: computedMidX, midY: computedMidY, scale: computedScale };
  }, [nodes]);

  // Project from Cartesian (x, y) to SVG (840x480)
  const project = (x: number, y: number) => ({
    x: 420 + (x - midX) * scale,
    y: 240 - (y - midY) * scale,
  });

  // Inverse project from SVG coordinate to Cartesian (x, y)
  const unproject = (svgX: number, svgY: number) => ({
    x: Math.round((midX + (svgX - 420) / scale) * 10) / 10,
    y: Math.round((midY - (svgY - 240) / scale) * 10) / 10,
  });

  function getSvgPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 420, y: 240 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 420, y: 240 };
    return pt.matrixTransform(ctm.inverse());
  }

  // Handle pointer down on background (Add node or deselect)
  function handleSvgPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.target !== e.currentTarget && (e.target as Element).tagName !== "rect") {
      return;
    }
    if (busy) return;

    const svgPt = getSvgPoint(e.clientX, e.clientY);
    const coords = unproject(svgPt.x, svgPt.y);

    if (tool === "add") {
      onAddNode(coords.x, coords.y);
    } else {
      setSelectedNodeId(null);
    }
  }

  // Handle double click on canvas in select mode to quickly add node
  function handleSvgDoubleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (busy) return;
    const svgPt = getSvgPoint(e.clientX, e.clientY);
    const coords = unproject(svgPt.x, svgPt.y);
    onAddNode(coords.x, coords.y);
  }

  // Node Drag Handlers
  function handleNodePointerDown(e: React.PointerEvent, nodeId: string) {
    e.stopPropagation();
    if (busy) return;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {}
    setDraggingNodeId(nodeId);
    setSelectedNodeId(nodeId);
  }

  function handleSvgPointerMove(e: React.PointerEvent) {
    if (!draggingNodeId || busy) return;
    const svgPt = getSvgPoint(e.clientX, e.clientY);
    const coords = unproject(svgPt.x, svgPt.y);
    onMoveNode(draggingNodeId, coords.x, coords.y);
  }

  function handleSvgPointerUp(e: React.PointerEvent) {
    if (draggingNodeId) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {}
      setDraggingNodeId(null);
    }
  }

  // Path rendering for closed route
  const getPathD = (route: Route) => {
    if (!route || route.length === 0) return "";
    return [...route, route[0]!]
      .filter((nodeIdx) => nodeIdx >= 0 && nodeIdx < nodes.length)
      .map((nodeIdx, idx) => {
        const node = nodes[nodeIdx];
        if (!node) return "";
        const p = project(node.x, node.y);
        return `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ");
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="interactive-canvas-card">
      {/* Canvas Top Toolbar */}
      <div className="canvas-toolbar">
        <div className="toolbar-group">
          <div className="tool-toggle-group">
            <button
              type="button"
              className={`tool-btn ${tool === "select" ? "active" : ""}`}
              onClick={() => setTool("select")}
              title="Mode Pilih & Geser (Drag Node)"
            >
              <MousePointer size={15} />
              <span>Geser</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === "add" ? "active" : ""}`}
              onClick={() => setTool("add")}
              title="Mode Tambah Node (Klik pada kanvas)"
            >
              <PlusCircle size={15} />
              <span>Tambah Node</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Quick dataset generators */}
          <button
            type="button"
            className="action-btn"
            disabled={busy}
            onClick={() => onRandomNodes(10)}
            title="Buat 10 titik acak"
          >
            <Shuffle size={14} />
            <span>Acak 10</span>
          </button>
          <button
            type="button"
            className="action-btn"
            disabled={busy}
            onClick={() => onRandomNodes(20)}
            title="Buat 20 titik acak"
          >
            <Shuffle size={14} />
            <span>Acak 20</span>
          </button>
          <button
            type="button"
            className="action-btn"
            disabled={busy}
            onClick={onLoadExample}
            title="Kembalikan dataset contoh 6 node"
          >
            <RotateCcw size={14} />
            <span>Contoh 6</span>
          </button>
        </div>

        <div className="toolbar-group">
          <button
            type="button"
            className="action-btn upload-btn"
            disabled={busy}
            onClick={() => setShowUploadModal(true)}
            title="Unggah berkas Excel .xlsx koordinat"
          >
            <Upload size={14} />
            <span>Upload File</span>
          </button>

          <button
            type="button"
            className="action-btn danger-btn"
            disabled={busy || nodes.length === 0}
            onClick={onClearNodes}
            title="Hapus semua titik"
          >
            <Trash2 size={14} />
            <span>Hapus Semua</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        className={`canvas-viewport-container ${tool === "add" ? "mode-add" : "mode-select"}`}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
      >
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <svg
          ref={svgRef}
          viewBox="0 0 840 480"
          className="interactive-svg"
          onPointerDown={handleSvgPointerDown}
          onDoubleClick={handleSvgDoubleClick}
          role="img"
          aria-label="Canvas Interaktif Traveling Salesman Problem"
        >
          <defs>
            <pattern id={`${id}-grid`} width="35" height="35" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#cbd5e1" opacity="0.6" />
            </pattern>
            {/* Center crosshair */}
            <pattern id={`${id}-major`} width="140" height="140" patternUnits="userSpaceOnUse">
              <path d="M 140 0 L 0 0 0 140" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
            </pattern>
          </defs>

          {/* Background grid */}
          <rect width="840" height="480" fill="#fcfdfa" />
          <rect width="840" height="480" fill={`url(#${id}-grid)`} />
          <rect width="840" height="480" fill={`url(#${id}-major)`} />

          {/* Center axis guide lines */}
          <line x1="420" y1="0" x2="420" y2="480" stroke="#f1f5f9" strokeWidth="1.5" />
          <line x1="0" y1="240" x2="840" y2="240" stroke="#f1f5f9" strokeWidth="1.5" />

          {/* Layer 1: Initial Route (Dashed grey) */}
          {initial.length > 2 && (
            <path
              d={getPathD(initial)}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.8"
              strokeDasharray="6 4"
              opacity="0.75"
            />
          )}

          {/* Layer 2: Current / Worker Progress Route (Dashed Blue) */}
          {current.length > 2 && phase !== "idle" && (
            <path
              d={getPathD(current)}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="2.2"
              strokeDasharray="8 4"
              opacity="0.9"
            />
          )}

          {/* Layer 3: Candidate Move (Amber) */}
          {candidate && candidate.length > 2 && (
            <path
              d={getPathD(candidate)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="4 4"
              opacity="0.85"
            />
          )}

          {/* Layer 4: Best Route (Emerald Solid) */}
          {best.length > 2 && (
            <path
              d={getPathD(best)}
              fill="none"
              stroke="#0d9488"
              strokeWidth="3.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="best-route-path"
            />
          )}

          {/* Layer 5: Nodes & Drag Handles */}
          {nodes.map((node) => {
            const p = project(node.x, node.y);
            const isStart = node.id === startId;
            const isSelected = node.id === selectedNodeId;
            const isDragging = node.id === draggingNodeId;

            return (
              <g
                key={node.id}
                className={`node-group ${isDragging ? "dragging" : ""}`}
                onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                }}
              >
                {/* Outer halo when selected or start */}
                {(isSelected || isStart) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isStart ? 18 : 16}
                    fill={isStart ? "#ccfbf1" : "#f1f5f9"}
                    stroke={isStart ? "#0d9488" : "#64748b"}
                    strokeWidth={1.5}
                    opacity="0.7"
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isStart ? 12 : 10}
                  fill={isStart ? "#14b8a6" : "#ffffff"}
                  stroke={isStart ? "#0f766e" : isSelected ? "#0d9488" : "#334155"}
                  strokeWidth={isSelected ? 2.5 : 2}
                  className="node-circle"
                />

                {/* Node Center Dot */}
                <circle cx={p.x} cy={p.y} r={2.5} fill={isStart ? "#ffffff" : "#0f766e"} />

                {/* Node Label Text */}
                <text
                  x={p.x}
                  y={p.y - 18}
                  textAnchor="middle"
                  className={`node-svg-label ${isStart ? "start-label" : ""}`}
                >
                  {node.id}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Empty State Banner */}
        {nodes.length === 0 && (
          <div className="canvas-empty-overlay">
            <p className="font-semibold text-slate-700">Kanvas masih kosong</p>
            <p className="text-sm text-slate-500">
              Klik di mana saja untuk menaruh node baru, atau gunakan tombol di toolbar.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => onRandomNodes(10)}>
                <Shuffle size={14} /> Buat 10 Node Acak
              </Button>
              <Button size="sm" variant="outline" onClick={onLoadExample}>
                <RotateCcw size={14} /> Muat Contoh 6 Node
              </Button>
            </div>
          </div>
        )}

        {/* Selected Node Floating Action Card */}
        {selectedNode && (
          <div className="selected-node-card">
            <div className="card-header">
              <span className="node-badge">Node {selectedNode.id}</span>
              <span className="coords-text">
                ({selectedNode.x}, {selectedNode.y})
              </span>
              <button
                type="button"
                className="close-btn"
                onClick={() => setSelectedNodeId(null)}
                aria-label="Tutup panel node"
              >
                <X size={13} />
              </button>
            </div>
            <div className="card-actions">
              {selectedNode.id !== startId ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSetStartId(selectedNode.id)}
                  title="Jadikan titik awal tour"
                >
                  <Flag size={13} /> Titik Awal
                </Button>
              ) : (
                <span className="start-badge">
                  <Flag size={12} /> Titik Awal Aktif
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => {
                  onRemoveNode(selectedNode.id);
                  setSelectedNodeId(null);
                }}
                disabled={busy}
                title="Hapus node ini"
              >
                <Trash2 size={13} /> Hapus
              </Button>
            </div>
          </div>
        )}

        {/* Live Route Strip at bottom of canvas */}
        <div className="canvas-footer-strip">
          <div className="canvas-status-item">
            <span className="status-dot live" />
            <span>
              {nodes.length} Node · {dataset.unit}
            </span>
          </div>

          <div className="canvas-legend">
            <span className="legend-item">
              <i className="legend-color initial" />
              <span>Awal</span>
            </span>
            {phase !== "idle" && (
              <span className="legend-item">
                <i className="legend-color current" />
                <span>Current</span>
              </span>
            )}
            <span className="legend-item">
              <i className="legend-color best" />
              <span>Terbaik (Best)</span>
            </span>
            <span className="legend-item">
              <i className="legend-start-dot" />
              <span>Start: {startId || "—"}</span>
            </span>
          </div>

          <div className="canvas-hint">
            <HelpCircle size={13} />
            <span>Klik bebas untuk pasang · Tarik untuk geser</span>
          </div>
        </div>
      </div>

      {/* Best Tour Path Text Bar */}
      {best.length > 0 && nodes.length >= 3 && (
        <div className="best-route-bar">
          <span className="route-title">RUTE TERBAIK:</span>
          <span className="route-sequence">{closedRoute(best, dataset).join(" → ")}</span>
        </div>
      )}

      {/* Upload File Modal */}
      {showUploadModal && (
        // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div className="modal-backdrop" onClick={() => setShowUploadModal(false)}>
          {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2 font-semibold">
                <FileSpreadsheet size={18} className="text-teal-700" />
                <span>Unggah Dataset Excel / Koordinat</span>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowUploadModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <ImportPanel
                busy={busy}
                onApply={(newDataset) => {
                  onUploadDataset(newDataset);
                  setShowUploadModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
