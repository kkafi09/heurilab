import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, X, TableProperties, AlertCircle, Check } from "lucide-react";
import { Button } from "../../components/ui";
import type { Dataset, TspNode } from "../../domain/tsp/model";
import {
  parseManualInputDraft,
  type ManualInputRowDraft,
  type ManualInputRowIssue,
} from "../../domain/tsp/manualInput";

export function ManualNodeModal({
  isOpen,
  onClose,
  baseDataset,
  isHistoricalSnapshot,
  sourceRunName,
  snapshotStartId,
  onSubmitNodes,
  busy,
}: {
  isOpen: boolean;
  onClose: () => void;
  baseDataset: Dataset;
  isHistoricalSnapshot?: boolean;
  sourceRunName?: string;
  snapshotStartId?: string;
  onSubmitNodes: (
    nodes: TspNode[],
    meta: {
      isHistoricalSnapshot?: boolean;
      baseDataset: Dataset;
      snapshotStartId?: string;
    },
  ) => void;
  busy: boolean;
}) {
  const [rows, setRows] = useState<ManualInputRowDraft[]>([
    { key: crypto.randomUUID(), id: "", x: "", y: "" },
  ]);
  const [issues, setIssues] = useState<ManualInputRowIssue[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousTriggerRef = useRef<HTMLElement | null>(null);
  const rowInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Reset draft when opened
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setRows([{ key: crypto.randomUUID(), id: "", x: "", y: "" }]);
      setIssues([]);
      setGeneralError(null);
      setAttempted(false);
    }
  }

  // Manage body scroll and focus on open/close
  useEffect(() => {
    if (isOpen) {
      previousTriggerRef.current = document.activeElement as HTMLElement;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // Focus first input field
      requestAnimationFrame(() => {
        const firstInput = dialogRef.current?.querySelector<HTMLInputElement>(
          'input[type="text"], input[inputmode="decimal"]',
        );
        firstInput?.focus();
      });

      return () => {
        document.body.style.overflow = originalOverflow;
        previousTriggerRef.current?.focus();
      };
    }
  }, [isOpen]);

  // Focus trap and Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusableElements.length) return;

        const firstElement = focusableElements[0]!;
        const lastElement = focusableElements[focusableElements.length - 1]!;

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filledCount = rows.filter(
    (r) => r.id.trim() !== "" || r.x.trim() !== "" || r.y.trim() !== "",
  ).length;
  const totalCount = baseDataset.nodes.length + filledCount;
  const isOverLimit = totalCount > 100;
  const canAddRow = baseDataset.nodes.length + rows.length < 100;

  function updateRow(key: string, field: "id" | "x" | "y", value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    if (attempted) {
      setIssues((prev) => prev.filter((i) => !(i.key === key && i.field === field)));
      setGeneralError(null);
    }
  }

  function handleAddRow() {
    if (!canAddRow) return;
    const newKey = crypto.randomUUID();
    setRows((prev) => [...prev, { key: newKey, id: "", x: "", y: "" }]);

    // Move focus to the new row's ID input after render
    requestAnimationFrame(() => {
      const input = rowInputRefs.current.get(`${newKey}-id`);
      input?.focus();
    });
  }

  function handleDeleteRow(key: string, index: number) {
    const remaining = rows.filter((r) => r.key !== key);
    if (remaining.length === 0) {
      const newKey = crypto.randomUUID();
      setRows([{ key: newKey, id: "", x: "", y: "" }]);
      requestAnimationFrame(() => {
        rowInputRefs.current.get(`${newKey}-id`)?.focus();
      });
    } else {
      setRows(remaining);
      // Keep focus on an existing control
      const targetIndex = Math.max(0, index - 1);
      const targetKey = remaining[targetIndex]?.key;
      requestAnimationFrame(() => {
        if (targetKey) {
          rowInputRefs.current.get(`${targetKey}-id`)?.focus();
        }
      });
    }
    setIssues((prev) => prev.filter((i) => i.key !== key));
  }

  function handleSubmit() {
    if (busy) return;
    setAttempted(true);

    const result = parseManualInputDraft(rows, baseDataset);
    if (!result.success) {
      setIssues(result.issues);
      setGeneralError(result.generalError ?? "Data tidak valid.");

      // Focus first error element
      if (result.firstErrorKey) {
        const field = result.firstErrorField ?? "id";
        const errorInput = rowInputRefs.current.get(`${result.firstErrorKey}-${field}`);
        errorInput?.focus();
      }
      return;
    }

    // Submit valid nodes atomically
    onSubmitNodes(result.nodes, {
      isHistoricalSnapshot,
      baseDataset,
      snapshotStartId,
    });
    onClose();
  }

  const getIssue = (key: string, field: "id" | "x" | "y") =>
    issues.find((i) => i.key === key && i.field === field)?.message;

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-dialog manual-node-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-node-modal-title"
      >
        {/* Header */}
        <div className="manual-modal-header">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
              <TableProperties size={18} />
            </div>
            <div>
              <h3 id="manual-node-modal-title" className="font-semibold text-slate-800 text-base">
                Tambahkan node secara manual
              </h3>
              <p className="text-xs text-slate-500">
                Mode append: koordinat baru akan ditambahkan ke dataset aktif.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Tutup dialog input manual"
          >
            <X size={16} />
          </button>
        </div>

        {/* Dataset Context Banner */}
        <div className="manual-modal-context-box">
          <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-700 font-medium">
            <span>
              Dataset dasar: <strong>{baseDataset.name}</strong> ({baseDataset.nodes.length} node
              sudah ada)
            </span>
            <span className="text-teal-700">Satuan: {baseDataset.unit}</span>
          </div>
          {isHistoricalSnapshot && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded p-1.5 border border-amber-200 mt-1">
              Catatan: Kanvas sedang menampilkan snapshot riwayat ({sourceRunName ?? "Run"}).
              Penambahan ini akan bercabang menjadi dataset kerja baru tanpa mengubah snapshot asli.
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            ID bersifat opsional (kosongkan untuk ID otomatis A–Z lalu N1, dst.). Koordinat X dan Y
            wajib diisi (dukung bilangan bulat, negatif, dan desimal; gunakan titik untuk desimal,
            misalnya -2.5).
          </p>
        </div>

        {/* Error Alert Banner */}
        {generalError && (
          <div className="manual-modal-error-alert" role="alert">
            <AlertCircle size={15} className="shrink-0 text-red-600 mt-0.5" />
            <div className="text-xs text-red-700 font-medium">{generalError}</div>
          </div>
        )}

        {/* Scrollable Table Area */}
        <div className="manual-modal-table-container">
          <table className="manual-modal-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: "30%" }}>
                  ID Node
                </th>
                <th scope="col" style={{ width: "30%" }}>
                  X
                </th>
                <th scope="col" style={{ width: "30%" }}>
                  Y
                </th>
                <th scope="col" style={{ width: "10%" }}>
                  <span className="sr-only">Hapus baris</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const idIssue = getIssue(row.key, "id");
                const xIssue = getIssue(row.key, "x");
                const yIssue = getIssue(row.key, "y");

                return (
                  <tr key={row.key}>
                    <td>
                      <input
                        ref={(el) => {
                          if (el) rowInputRefs.current.set(`${row.key}-id`, el);
                          else rowInputRefs.current.delete(`${row.key}-id`);
                        }}
                        type="text"
                        className={`manual-input-cell ${idIssue ? "has-error" : ""}`}
                        value={row.id}
                        placeholder="Otomatis"
                        maxLength={40}
                        aria-label={`ID node baris ${idx + 1}`}
                        aria-invalid={Boolean(idIssue)}
                        aria-describedby={idIssue ? `err-${row.key}-id` : undefined}
                        onChange={(e) => updateRow(row.key, "id", e.target.value)}
                      />
                      {idIssue && (
                        <span id={`err-${row.key}-id`} className="cell-error-msg">
                          {idIssue}
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        ref={(el) => {
                          if (el) rowInputRefs.current.set(`${row.key}-x`, el);
                          else rowInputRefs.current.delete(`${row.key}-x`);
                        }}
                        type="text"
                        inputMode="decimal"
                        className={`manual-input-cell ${xIssue ? "has-error" : ""}`}
                        value={row.x}
                        placeholder="mis. 0 atau -2.5"
                        aria-label={`X node baris ${idx + 1}`}
                        aria-invalid={Boolean(xIssue)}
                        aria-describedby={xIssue ? `err-${row.key}-x` : undefined}
                        onChange={(e) => updateRow(row.key, "x", e.target.value)}
                      />
                      {xIssue && (
                        <span id={`err-${row.key}-x`} className="cell-error-msg">
                          {xIssue}
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        ref={(el) => {
                          if (el) rowInputRefs.current.set(`${row.key}-y`, el);
                          else rowInputRefs.current.delete(`${row.key}-y`);
                        }}
                        type="text"
                        inputMode="decimal"
                        className={`manual-input-cell ${yIssue ? "has-error" : ""}`}
                        value={row.y}
                        placeholder="mis. 0 atau -2.5"
                        aria-label={`Y node baris ${idx + 1}`}
                        aria-invalid={Boolean(yIssue)}
                        aria-describedby={yIssue ? `err-${row.key}-y` : undefined}
                        onChange={(e) => updateRow(row.key, "y", e.target.value)}
                      />
                      {yIssue && (
                        <span id={`err-${row.key}-y`} className="cell-error-msg">
                          {yIssue}
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="icon-button delete-row-btn"
                        aria-label={`Hapus baris ${idx + 1}`}
                        onClick={() => handleDeleteRow(row.key, idx)}
                        title={`Hapus baris ${idx + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Info */}
        <div className="manual-modal-summary">
          <div className="text-xs text-slate-600">
            Node baru akan ditambahkan: <strong>{filledCount}</strong> baris · Total setelah
            penambahan:{" "}
            <strong className={isOverLimit ? "text-red-600" : "text-teal-700"}>
              {totalCount} / 100 node
            </strong>
          </div>
          {isOverLimit && (
            <div className="text-xs text-red-600 font-medium">
              Total melampaui batas maksimum 100 node.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="manual-modal-footer">
          <button
            type="button"
            className="action-btn text-teal-700 border-teal-300 hover:bg-teal-50"
            disabled={!canAddRow || busy}
            onClick={handleAddRow}
          >
            <Plus size={14} />
            <span>Tambah baris</span>
          </button>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={busy || isOverLimit || filledCount === 0}
            >
              <Check size={14} />
              <span>Tambahkan ke kanvas</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
