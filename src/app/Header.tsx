import { FlaskConical, LayoutGrid, FileText, CheckCircle2, BookOpen } from "lucide-react";
import { Button } from "../components/ui";

export function Header({
  view,
  onViewChange,
  runsCount,
  ready,
  saved,
  storageError,
  hasConfigErrors,
  onToggleHelp,
}: {
  view: "playground" | "report";
  onViewChange: (view: "playground" | "report") => void;
  runsCount: number;
  ready: boolean;
  saved: boolean;
  storageError: string | null;
  hasConfigErrors: boolean;
  onToggleHelp: () => void;
}) {
  return (
    <header className="site-header-compact">
      <div className="header-left">
        <a href="/" className="brand" aria-label="HeuriLab beranda">
          <span className="brand-mark">
            <FlaskConical size={20} />
          </span>
          <span className="brand-title">
            Heuri<span className="brand-accent">Lab</span>
          </span>
          <span className="version-tag">LAB / 01</span>
        </a>

        {/* View Switcher: Playground vs Report */}
        <nav className="view-switcher" aria-label="Tampilan Utama">
          <button
            type="button"
            className={`view-tab ${view === "playground" ? "active" : ""}`}
            onClick={() => onViewChange("playground")}
          >
            <LayoutGrid size={15} />
            <span>Playground</span>
          </button>
          <button
            type="button"
            className={`view-tab ${view === "report" ? "active" : ""}`}
            onClick={() => onViewChange("report")}
          >
            <FileText size={15} />
            <span>Report</span>
            {runsCount > 0 && <span className="tab-badge">{runsCount}</span>}
          </button>
        </nav>
      </div>

      <div className="header-actions">
        <span className="storage-status">
          {!ready ? (
            "Memuat sesi…"
          ) : storageError ? (
            "Mode memori"
          ) : hasConfigErrors ? (
            "Parameter belum valid"
          ) : saved ? (
            <>
              <CheckCircle2 size={13} className="text-emerald-600" />
              Tersimpan lokal
            </>
          ) : (
            "Menyimpan sesi…"
          )}
        </span>

        <Button size="sm" variant="ghost" onClick={onToggleHelp}>
          <BookOpen size={15} />
          Panduan
        </Button>
      </div>
    </header>
  );
}
