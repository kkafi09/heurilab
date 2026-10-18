import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  X,
  MousePointer,
  Activity,
  FileSpreadsheet,
  Compass,
  MapPin,
  Move,
  Upload,
  RotateCcw,
  GitBranch,
  Flame,
  TableProperties,
  TrendingDown,
  Download,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../../components/ui";

type TabId = "canvas" | "algorithms" | "report" | "theory";

const TABS: { id: TabId; label: string; icon: typeof MousePointer }[] = [
  { id: "canvas", label: "Kanvas & Node", icon: MousePointer },
  { id: "algorithms", label: "Metode & Parameter", icon: Activity },
  { id: "report", label: "Laporan & Trace", icon: FileSpreadsheet },
  { id: "theory", label: "Formula & Teori", icon: Compass },
];

export function HelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("canvas");
  const previousTriggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setActiveTab("canvas");
    }
  }

  // Manage open/close focus, body scroll lock
  useEffect(() => {
    if (isOpen) {
      previousTriggerRef.current = document.activeElement as HTMLElement;

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      requestAnimationFrame(() => {
        closeBtnRef.current?.focus();
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
        }
      });

      return () => {
        document.body.style.overflow = originalOverflow;
        previousTriggerRef.current?.focus();
      };
    }
  }, [isOpen]);

  function selectTab(tabId: TabId) {
    setActiveTab(tabId);
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }

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
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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

  // Tab navigation with arrow keys
  function handleTabKeyDown(event: React.KeyboardEvent, index: number) {
    let targetIndex = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      targetIndex = (index + 1) % TABS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      targetIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      event.preventDefault();
      targetIndex = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      targetIndex = TABS.length - 1;
    }

    if (targetIndex >= 0) {
      const nextTab = TABS[targetIndex]!;
      selectTab(nextTab.id);
      const nextBtn = document.getElementById(`help-tab-${nextTab.id}`);
      nextBtn?.focus();
    }
  }

  if (!isOpen) return null;

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
        className="modal-dialog help-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        {/* Header */}
        <div className="help-modal-header">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 id="help-modal-title">Panduan Interaktif HeuriLab</h3>
              <p className="text-xs text-slate-500">
                Eksplorasi optimasi Traveling Salesman Problem (TSP) dengan metode metaheuristik
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Tutup panduan"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className="help-tabs-bar"
          role="tablist"
          aria-label="Kategori navigasi panduan HeuriLab"
        >
          {TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`help-tab-${tab.id}`}
                role="tab"
                type="button"
                className={`help-tab-btn ${isSelected ? "active" : ""}`}
                aria-selected={isSelected}
                aria-controls={`help-tabpanel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Container */}
        <div
          ref={contentRef}
          id={`help-tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`help-tab-${activeTab}`}
          className="help-content-area"
          tabIndex={0}
        >
          {activeTab === "canvas" && (
            <div className="space-y-3">
              <div className="help-feature-card">
                <div className="help-feature-title">
                  <MapPin size={16} className="text-teal-700" />
                  <span>Tambah Node pada Kanvas</span>
                </div>
                <p>
                  Pilih mode <em>Tambah Node</em> pada toolbar di atas kanvas (atau klik ganda saat
                  di mode Geser), lalu klik pada area grid. Node baru otomatis dibuat dengan
                  koordinat Cartesian planar serta ID unik.
                </p>
              </div>

              <div className="help-feature-card">
                <div className="help-feature-title">
                  <Move size={16} className="text-teal-700" />
                  <span>Drag & Drop Posisi Node</span>
                </div>
                <p>
                  Tarik lingkaran node ke posisi koordinat baru di kanvas. Jarak rute, koordinat
                  numerik, dan matriks jarak Euclidean planar langsung diperbarui secara interaktif.
                </p>
              </div>

              <div className="help-feature-card">
                <div className="help-feature-title">
                  <TableProperties size={16} className="text-teal-700" />
                  <span>Input Manual Melalui Tabel</span>
                </div>
                <p>
                  Gunakan tombol <em>Input manual</em> pada toolbar kanvas untuk memasukkan beberapa
                  koordinat sekaligus melalui tabel ID/X/Y. ID bersifat opsional (dibuat otomatis
                  A–Z lalu N1, dst. bila dikosongkan), koordinat X dan Y wajib diisi (gunakan titik
                  untuk desimal, misalnya -2.5). Node baru ditambahkan (append) ke dataset aktif.
                  Sesi dapat menyimpan draf kerja 1 atau 2 node, namun eksperimen optimasi
                  memerlukan minimal 3 node.
                </p>
              </div>

              <div className="help-feature-card">
                <div className="help-feature-title">
                  <Upload size={16} className="text-teal-700" />
                  <span>Impor File Dataset Excel (.xlsx)</span>
                </div>
                <p>
                  Gunakan tombol <em>Impor Excel</em> untuk memuat koordinat node dari berkas
                  spreadsheet (.xlsx). Data node akan divalidasi dan disesuaikan ukurannya secara
                  otomatis pada kanvas.
                </p>
              </div>
            </div>
          )}

          {activeTab === "algorithms" && (
            <div className="space-y-3">
              <div className="p-3.5 bg-teal-50/60 rounded-xl border border-teal-200 text-teal-950">
                <div className="help-feature-title text-teal-900">
                  <Activity size={16} className="text-teal-700" />
                  <span>Tabu Search (TS)</span>
                </div>
                <p className="text-sm">
                  Metode pencarian lingkungan lokal (neighborhood 2-OPT) berbasis memori tabu. Pada
                  tiap iterasi, TS mengevaluasi seluruh tetangga yang memenuhi syarat (eligible) dan
                  memilih perbaikan terbaik, bahkan jika nilainya lebih buruk dari solusi saat ini,
                  agar dapat keluar dari optimum lokal.
                </p>
                <ul className="list-disc list-inside mt-2 text-xs space-y-1 text-teal-900">
                  <li>
                    <strong>Tabu Tenure:</strong> Atribut sisi undirected yang dihapus pada langkah
                    pembalikan dicatat sebagai tabu untuk ditambahkan kembali selama masa tenure
                    berlaku (inklusif).
                  </li>
                  <li>
                    <strong>Aspiration Criteria:</strong> Mengizinkan pemilihan langkah yang
                    berstatus tabu jika langkah tersebut menghasilkan biaya yang secara ketat
                    mengalahkan rekor terbaik global (best-so-far).
                  </li>
                  <li>
                    <strong>Best-so-Far:</strong> Solusi rekor terbaik yang dicatat selama
                    pencarian, dipisahkan dari current solution, dan tidak identik dengan bukti
                    optimum global.
                  </li>
                </ul>
              </div>

              <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 text-amber-950">
                <div className="help-feature-title text-amber-900">
                  <Flame size={16} className="text-amber-700" />
                  <span>Simulated Annealing (SA)</span>
                </div>
                <p className="text-sm">
                  Mengadopsi prinsip pendinginan termal logam. Mengambil satu kandidat langkah 2-OPT
                  acak uniform per iterasi. Solusi yang lebih baik atau sama (Δ ≤ 0) selalu
                  diterima. Solusi yang lebih buruk (Δ &gt; 0) diterima dengan probabilitas{" "}
                  <code>P = exp(-Δ / T)</code> yang diuji terhadap random draw RNG Mulberry32
                  ber-seed.
                </p>
                <ul className="list-disc list-inside mt-2 text-xs space-y-1 text-amber-900">
                  <li>
                    <strong>Suhu Awal (T₀):</strong> Temperatur eksplorasi awal. Suhu tinggi
                    memperbesar toleransi penerimaan solusi buruk.
                  </li>
                  <li>
                    <strong>Cooling Rate (α):</strong> Laju pendinginan geometrik (T ← α × T)
                    setelah blok iterasi per suhu selesai.
                  </li>
                  <li>
                    <strong>Suhu Minimum:</strong> Ambang batas penghentian pendinginan apabila suhu
                    telah mencapai nilai minimum.
                  </li>
                  <li>
                    <strong>Seed:</strong> Mengontrol generator bilangan acak sehingga keputusan
                    pencarian dapat direproduksi secara deterministik.
                  </li>
                </ul>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800">
                <div className="help-feature-title">
                  <GitBranch size={16} className="text-teal-700" />
                  <span>Solusi Awal & Local Search</span>
                </div>
                <ul className="list-disc list-inside text-xs space-y-1 text-slate-700">
                  <li>
                    <strong>Nearest Neighbor (NN):</strong> Memilih node terdekat yang belum
                    dikunjungi dari posisi terakhir.
                  </li>
                  <li>
                    <strong>Nearest Insertion (NI):</strong> Memulai dari 2 node terdekat, memilih
                    node terdekat ke tour, lalu menyisipkannya pada sisi dengan kenaikan biaya
                    terkecil.
                  </li>
                  <li>
                    <strong>Nearest Farthest Insertion (NFI):</strong> Memulai dari node awal dan
                    tetangga terdekat, memilih node di luar tour dengan jarak minimum-ke-tour
                    terbesar, lalu menyisipkannya pada sisi dengan kenaikan biaya terkecil.
                  </li>
                  <li>
                    <strong>2-OPT Local Search:</strong> Membalik segmen rute dengan menukar 2 sisi
                    hingga mencapai optimum lokal (tidak ada perbaikan).
                  </li>
                  <li>
                    <strong>3-OPT Local Search:</strong> Mengevaluasi 7 rekoneksi non-trivial dari 3
                    sisi tidak bersebelahan dan memilih perbaikan terbaik.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "report" && (
            <div className="space-y-3">
              <div className="help-feature-card">
                <div className="help-feature-title">
                  <TableProperties size={16} className="text-teal-700" />
                  <span>Leaderboard Perbandingan Eksperimen</span>
                </div>
                <p>
                  Membandingkan seluruh run yang pernah dijalankan dalam satu tabel komparatif.
                  Menampilkan kategori (Konstruksi, Local Search, atau Metaheuristik), jarak awal,
                  jarak terbaik, persentase peningkatan, waktu komputasi tiap tahap, serta parameter
                  konfigurasi.
                </p>
              </div>

              <div className="help-feature-card">
                <div className="help-feature-title">
                  <TrendingDown size={16} className="text-teal-700" />
                  <span>Analisis Konvergensi & Trace Detail</span>
                </div>
                <p>
                  Grafik konvergensi menampilkan dinamika penurunan biaya rute terhadap iterasi.
                  Tabel trace memungkinkan penelusuran langkah per iterasi, status tabu, aspiration,
                  peluang penerimaan, serta alasan keputusan algoritma.
                </p>
              </div>

              <div className="help-feature-card">
                <div className="help-feature-title">
                  <Download size={16} className="text-teal-700" />
                  <span>Ekspor Laporan (CSV & JSON)</span>
                </div>
                <p>
                  Hasil komparasi dapat diunduh dalam format <strong>CSV</strong> (untuk analisis
                  spreadsheet) atau <strong>JSON</strong> lengkap (memuat detail dataset, rute,
                  konfigurasi, dan trace pencarian untuk bahan laporan akademik).
                </p>
              </div>
            </div>
          )}

          {activeTab === "theory" && (
            <div className="space-y-3">
              <div className="help-feature-card">
                <div className="help-feature-title">
                  <Compass size={16} className="text-teal-700" />
                  <span>Jarak Euclidean Planar</span>
                </div>
                <p>
                  Jarak antara dua node <code>A(x₁, y₁)</code> dan <code>B(x₂, y₂)</code> dihitung
                  dalam ruang koordinat 2D:
                </p>
                <div className="my-2 p-2 rounded bg-slate-100 border border-slate-200 text-xs font-mono text-teal-800">
                  d(A, B) = √((x₂ - x₁)² + (y₂ - y₁)²)
                </div>
                <p className="text-xs text-slate-500">
                  Matriks jarak bersifat simetris dengan diagonal nol (d(A, A) = 0). Satuan yang
                  digunakan adalah unit koordinat planar.
                </p>
              </div>

              <div className="help-feature-card">
                <div className="help-feature-title">
                  <RotateCcw size={16} className="text-teal-700" />
                  <span>Rute Tertutup (Closed Hamiltonian Cycle)</span>
                </div>
                <p>
                  Traveling Salesman Problem (TSP) mensyaratkan setiap node dikunjungi tepat satu
                  kali dan kembali ke titik keberangkatan awal, misalnya:{" "}
                  <code>A → B → C → D → E → F → A</code>.
                </p>
              </div>

              <div className="help-feature-card">
                <div className="help-feature-title">
                  <CheckCircle2 size={16} className="text-teal-700" />
                  <span>Dataset Acuan Sintetis (6 Node)</span>
                </div>
                <p className="text-xs text-slate-600">
                  Fixture acuan <code>data/example-six.json</code>: A(0,0), B(4,0), C(7,3), D(5,7),
                  E(1,6), F(-2,3). Rute awal Nearest Neighbor dari node A menghasilkan panjang
                  24.686074230319797 yang telah diverifikasi independen sebagai panjang optimal.
                  Peningkatan 0% pada konfigurasi ini adalah hasil yang sah.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="help-modal-footer">
          <Button size="sm" onClick={onClose}>
            Mengerti & Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}
