import { useState } from "react";
import { Plus, RotateCcw, Trash2, Check, Upload } from "lucide-react";
import { Button } from "../../components/ui";
import { EXAMPLE, validateDataset, type Dataset } from "../../domain/tsp/model";
import { ImportPanel } from "./ImportPanel";

interface DraftNode {
  key: number;
  id: string;
  x: string;
  y: string;
}
export function DatasetPanel({
  dataset,
  busy,
  onApply,
}: {
  dataset: Dataset;
  busy: boolean;
  onApply: (dataset: Dataset) => void;
}) {
  const [draft, setDraft] = useState<DraftNode[]>(() =>
    dataset.nodes.map((node, key) => ({ key, id: node.id, x: String(node.x), y: String(node.y) })),
  );
  const [nextKey, setNextKey] = useState(dataset.nodes.length),
    [showImport, setShowImport] = useState(false),
    [attempted, setAttempted] = useState(false);
  const candidate: Dataset = {
    ...dataset,
    nodes: draft.map((node) => ({
      id: node.id.trim(),
      x: node.x.trim() === "" ? NaN : Number(node.x),
      y: node.y.trim() === "" ? NaN : Number(node.y),
    })),
  };
  const issues = validateDataset(candidate);
  const update = (key: number, field: "id" | "x" | "y", value: string) =>
    setDraft((rows) => rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  function apply() {
    setAttempted(true);
    if (!issues.length)
      onApply({
        ...candidate,
        id: crypto.randomUUID(),
        name: "Dataset manual",
        provenance: "Koordinat planar yang dimasukkan pengguna.",
      });
  }
  return (
    <section className="panel dataset-panel" aria-labelledby="dataset-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">01 · DATASET</span>
          <h2 id="dataset-title">Tentukan titikmu</h2>
        </div>
        <span className="count-tag">{dataset.nodes.length} node aktif</span>
      </div>
      <p className="muted small">
        Koordinat planar, jarak Euclidean. Perubahan diterapkan setelah validasi.
      </p>
      <div className="node-editor">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>X</th>
              <th>Y</th>
              <th>
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.map((node, row) => (
              <tr key={node.key}>
                {(["id", "x", "y"] as const).map((field) => (
                  <td key={field}>
                    <input
                      aria-label={`${field.toUpperCase()} node ${row + 1}`}
                      aria-invalid={
                        attempted &&
                        issues.some((issue) => issue.row === row && issue.field === field)
                      }
                      disabled={busy}
                      value={node[field]}
                      inputMode={field === "id" ? "text" : "decimal"}
                      maxLength={field === "id" ? 40 : undefined}
                      onChange={(event) => update(node.key, field, event.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Hapus node ${row + 1}`}
                    disabled={busy}
                    onClick={() => setDraft((rows) => rows.filter((item) => item.key !== node.key))}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {attempted && issues.length > 0 && (
        <ul className="errors" role="alert">
          {issues.map((issue, i) => (
            <li key={i}>
              {issue.row !== undefined ? `Node ${issue.row + 1}: ` : ""}
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      <div className="button-row">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || draft.length >= 100}
          onClick={() => {
            setDraft((rows) => [...rows, { key: nextKey, id: `N${nextKey + 1}`, x: "", y: "" }]);
            setNextKey((key) => key + 1);
          }}
        >
          <Plus size={14} />
          Tambah node
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={apply}>
          <Check size={14} />
          Terapkan
        </Button>
      </div>
      <div className="dataset-actions">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onApply({ ...structuredClone(EXAMPLE), id: crypto.randomUUID() })}
        >
          <RotateCcw size={14} />
          Contoh 6 node
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setShowImport((value) => !value)}
        >
          <Upload size={14} />
          Impor Excel
        </Button>
      </div>
      {showImport && (
        <ImportPanel
          busy={busy}
          onApply={(imported) => {
            onApply(imported);
            setShowImport(false);
          }}
        />
      )}
    </section>
  );
}
