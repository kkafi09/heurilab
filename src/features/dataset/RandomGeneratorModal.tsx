import { useState, useEffect, useRef } from "react";
import { Sparkles, X, AlertCircle, Shuffle } from "lucide-react";
import { Button, Field } from "../../components/ui";
import {
  validateGeneratorConfig,
  type GeneratorConfig,
  type GeneratorDistribution,
} from "../../domain/tsp/randomGenerator";

export function RandomGeneratorModal({
  isOpen,
  onClose,
  onGenerate,
  busy,
  initialCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: GeneratorConfig) => void;
  busy: boolean;
  initialCount?: number;
}) {
  const [nodeCount, setNodeCount] = useState<string>("10");
  const [distribution, setDistribution] = useState<GeneratorDistribution>("uniform");
  const [clusterCount, setClusterCount] = useState<string>("3");
  const [useFixedSeed, setUseFixedSeed] = useState<boolean>(false);
  const [seed, setSeed] = useState<string>("42");
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousTriggerRef = useRef<HTMLElement | null>(null);

  // Sync state when opened
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      if (initialCount && initialCount >= 3 && initialCount <= 100) {
        setNodeCount(String(initialCount));
      }
      setError(null);
    }
  }

  useEffect(() => {
    if (isOpen) {
      previousTriggerRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => {
        const input = dialogRef.current?.querySelector("input");
        input?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
      };
    } else {
      document.body.style.overflow = "";
      previousTriggerRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const parsedCount = Number(nodeCount);
  const maxClusters = Math.min(
    10,
    Number.isInteger(parsedCount) && parsedCount >= 1 ? parsedCount : 10,
  );

  function handleSetCount(count: number) {
    setNodeCount(String(count));
    setError(null);
    // Sesuaikan clusterCount jika melebihi batas baru
    const currentCl = Number(clusterCount);
    const newMaxCl = Math.min(10, count);
    if (currentCl > newMaxCl) {
      setClusterCount(String(newMaxCl));
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (busy) return;

    const countNum = nodeCount.trim() === "" ? NaN : Number(nodeCount);
    const clusterNum = clusterCount.trim() === "" ? NaN : Number(clusterCount);
    const seedNum = useFixedSeed ? (seed.trim() === "" ? NaN : Number(seed)) : undefined;

    const config: GeneratorConfig = {
      nodeCount: countNum,
      distribution,
      clusterCount: distribution === "cluster" ? clusterNum : undefined,
      seed: seedNum,
    };

    const errors = validateGeneratorConfig(config);
    if (errors.length > 0) {
      setError(errors.join(" "));
      return;
    }

    setError(null);
    onGenerate(config);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="generator-modal-title"
        aria-describedby="generator-modal-desc"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 shadow-xs">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 id="generator-modal-title" className="text-base font-bold text-slate-800">
                Generator Dataset Acak
              </h3>
              <p id="generator-modal-desc" className="text-xs text-slate-500">
                Bangkitkan koordinat planar dan rute acak awal yang belum dioptimasi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Tutup dialog generator"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Notice info banner */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Mengganti node pada kanvas; riwayat hasil tetap tersimpan.</strong>
              <p className="mt-0.5 text-amber-800">
                Pembangkitan dataset baru tidak akan menghapus atau mengubah hasil run sebelumnya di
                riwayat.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Field: Jumlah Node */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="gen-node-count"
                className="text-xs font-bold text-slate-700 uppercase tracking-wide"
              >
                Jumlah Node (3–100)
              </label>
              <div className="flex items-center gap-1">
                {[10, 20, 50, 100].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handleSetCount(count)}
                    disabled={busy}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                      nodeCount === String(count)
                        ? "bg-teal-50 text-teal-700 border-teal-300"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <input
              id="gen-node-count"
              type="number"
              min={3}
              max={100}
              step={1}
              disabled={busy}
              value={nodeCount}
              onChange={(e) => {
                setNodeCount(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white font-tabular text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
              placeholder="Contoh: 10"
              required
            />
          </div>

          {/* Field: Distribusi */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
              Distribusi Koordinat
            </span>
            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Distribusi Koordinat"
            >
              <label
                className={`p-3 text-left rounded-xl border transition-all cursor-pointer flex flex-col ${
                  distribution === "uniform"
                    ? "bg-teal-50/60 border-teal-500 shadow-xs"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="gen-distribution"
                    value="uniform"
                    checked={distribution === "uniform"}
                    onChange={() => {
                      setDistribution("uniform");
                      setError(null);
                    }}
                    disabled={busy}
                    aria-label="Merata (Uniform)"
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Merata (Uniform)</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 pl-5">
                  X & Y independen pada rentang [−100, 100]
                </span>
              </label>

              <label
                className={`p-3 text-left rounded-xl border transition-all cursor-pointer flex flex-col ${
                  distribution === "cluster"
                    ? "bg-teal-50/60 border-teal-500 shadow-xs"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="gen-distribution"
                    value="cluster"
                    checked={distribution === "cluster"}
                    onChange={() => {
                      setDistribution("cluster");
                      setError(null);
                    }}
                    disabled={busy}
                    aria-label="Cluster (Kelompok)"
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Cluster (Kelompok)</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 pl-5">
                  Sebaran Gaussian di sekitar pusat cluster
                </span>
              </label>
            </div>
          </div>

          {/* Field: Jumlah Cluster (Khusus Cluster) */}
          {distribution === "cluster" && (
            <Field
              label={`Jumlah Cluster (1–${maxClusters})`}
              hint="Pusat cluster berada di rentang [−60, 60] dengan simpangan baku 12 unit."
            >
              <input
                id="gen-cluster-count"
                type="number"
                min={1}
                max={maxClusters}
                step={1}
                disabled={busy}
                value={clusterCount}
                onChange={(e) => {
                  setClusterCount(e.target.value);
                  setError(null);
                }}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white font-tabular text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
                placeholder="Contoh: 3"
              />
            </Field>
          )}

          {/* Field: Pengaturan Seed Data */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={busy}
                checked={useFixedSeed}
                onChange={(e) => {
                  setUseFixedSeed(e.target.checked);
                  setError(null);
                }}
                className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-700">
                Gunakan seed tetap untuk reproduktifitas data
              </span>
            </label>

            {useFixedSeed ? (
              <Field
                label="Seed Data (0–4.294.967.295)"
                hint="Seed data berbeda dari seed SA. Seed ini menghasilkan koordinat dan tour acak awal yang persis sama."
              >
                <input
                  id="gen-seed-value"
                  type="number"
                  min={0}
                  max={4294967295}
                  step={1}
                  disabled={busy}
                  value={seed}
                  onChange={(e) => {
                    setSeed(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white font-tabular text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
                  placeholder="Contoh: 42"
                />
              </Field>
            ) : (
              <p className="text-[11px] text-slate-500 pl-6">
                Mode acak baru: seed uint32 baru akan dibangkitkan otomatis oleh peramban setiap
                kali Generate diklik.
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleSubmit()}
            disabled={busy}
          >
            <Shuffle size={14} />
            <span>Generate Dataset</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
