import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button, Field } from "../../components/ui";
import {
  downloadTemplate,
  guessColumns,
  previewSheet,
  readWorkbook,
  type WorkbookData,
  type ColumnMapping,
} from "../../services/excel";
import type { Dataset } from "../../domain/tsp/model";
export function ImportPanel({
  busy,
  onApply,
}: {
  busy: boolean;
  onApply: (dataset: Dataset) => void;
}) {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null),
    [sheetIndex, setSheetIndex] = useState(0),
    [mapping, setMapping] = useState<ColumnMapping>({ id: 0, x: 1, y: 2 }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
  const sheet = workbook?.sheets[sheetIndex],
    preview = sheet ? previewSheet(sheet, mapping) : null;
  async function upload(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setError(null);
    setWorkbook(null);
    try {
      const data = await readWorkbook(file),
        index = data.sheets.findIndex((item) => item.rows.length > 1);
      setWorkbook(data);
      setSheetIndex(index);
      setMapping(guessColumns(data.sheets[index]!));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "File gagal dibaca.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="import-panel">
      <h3>
        <FileSpreadsheet size={17} />
        Impor koordinat
      </h3>
      <p className="small muted">
        File .xlsx, maksimal 10 MB. Baris pertama adalah header. Angka desimal memakai titik.
      </p>
      <Field label="Pilih file Excel">
        <input
          type="file"
          accept=".xlsx"
          disabled={busy || loading}
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </Field>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          void downloadTemplate().catch((cause) => setError(String(cause)));
        }}
      >
        <Download size={14} />
        Unduh template
      </Button>
      {loading && <p role="status">Membaca workbook…</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {sheet && preview && (
        <>
          <Field label="Sheet">
            <select
              value={sheetIndex}
              onChange={(event) => {
                const index = Number(event.target.value);
                setSheetIndex(index);
                setMapping(guessColumns(workbook!.sheets[index]!));
              }}
            >
              {workbook!.sheets.map((item, index) => (
                <option value={index} key={index}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="three-fields">
            {(["id", "x", "y"] as const).map((field) => (
              <Field key={field} label={`Kolom ${field.toUpperCase()}`}>
                <select
                  value={mapping[field]}
                  onChange={(event) =>
                    setMapping((value) => ({ ...value, [field]: Number(event.target.value) }))
                  }
                >
                  <option value={-1}>Pilih…</option>
                  {sheet.rows[0]!.map((header, index) => (
                    <option key={index} value={index}>
                      {String(header || `Kolom ${index + 1}`)}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <p className="small">
            Preview: {preview.dataset.nodes.length} node · dataset aktif belum berubah.
          </p>
          <div className="table-scroll import-preview">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>X</th>
                  <th>Y</th>
                </tr>
              </thead>
              <tbody>
                {preview.dataset.nodes.slice(0, 8).map((node, index) => (
                  <tr key={index}>
                    <td>{node.id || "—"}</td>
                    <td>{String(node.x)}</td>
                    <td>{String(node.y)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.issues.length > 0 && (
            <ul className="errors" role="alert">
              {preview.issues.slice(0, 20).map((issue, index) => (
                <li key={index}>
                  {issue.row !== undefined ? `Baris ${issue.row}: ` : ""}
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
          <Button
            size="sm"
            disabled={busy || preview.issues.length > 0}
            onClick={() => onApply({ ...preview.dataset, id: crypto.randomUUID() })}
          >
            Terapkan impor
          </Button>
        </>
      )}
    </div>
  );
}
