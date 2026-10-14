import { useState, useEffect } from "react";
import { BookOpen, X, MousePointer, Activity, FileSpreadsheet, Compass } from "lucide-react";
import { Button } from "../../components/ui";

export function HelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"canvas" | "algorithms" | "report" | "theory">(
    "canvas",
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

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
        className="modal-dialog help-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 id="help-modal-title" className="font-bold text-slate-800 text-base">
                Panduan Interaktif HeuriLab
              </h3>
              <p className="text-xs text-slate-500">
                Eksplorasi optimasi Traveling Salesman Problem (TSP) dengan metaheuristik
              </p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Tutup panduan">
            <X size={16} />
          </button>
        </div>

        {/* Modal Tabs Bar */}
        <div className="help-tabs-bar">
          <button
            type="button"
            className={`help-tab-btn ${activeTab === "canvas" ? "active" : ""}`}
            onClick={() => setActiveTab("canvas")}
          >
            <MousePointer size={14} />
            <span>Kanvas & Node</span>
          </button>
          <button
            type="button"
            className={`help-tab-btn ${activeTab === "algorithms" ? "active" : ""}`}
            onClick={() => setActiveTab("algorithms")}
          >
            <Activity size={14} />
            <span>TS & SA</span>
          </button>
          <button
            type="button"
            className={`help-tab-btn ${activeTab === "report" ? "active" : ""}`}
            onClick={() => setActiveTab("report")}
          >
            <FileSpreadsheet size={14} />
            <span>Laporan & Trace</span>
          </button>
          <button
            type="button"
            className={`help-tab-btn ${activeTab === "theory" ? "active" : ""}`}
            onClick={() => setActiveTab("theory")}
          >
            <Compass size={14} />
            <span>Formula & Teori</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="help-content-area">
          {activeTab === "canvas" && (
            <div className="space-y-3 text-sm text-slate-600">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-slate-800 block mb-1">
                  📍 Klik Bebas untuk Tambah Node
                </strong>
                <p>
                  Pilih mode <em>Tambah Node</em> di toolbar atas kanvas (atau double-click di mode
                  Geser), lalu klik di mana saja pada grid kanvas. Node baru otomatis dibuat dengan
                  koordinat Cartesian planar.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-slate-800 block mb-1">✋ Drag & Drop Repositioning</strong>
                <p>
                  Klik dan tarik lingkaran node ke posisi mana pun. Koordinat numerik, jarak total
                  rute, dan matriks jarak Euclidean langsung dihitung ulang secara real-time.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-slate-800 block mb-1">📁 Upload & Auto-fit Dataset</strong>
                <p>
                  Gunakan tombol <em>Upload File</em> untuk membaca file Excel (.xlsx). Node hasil
                  impor akan otomatis disesuaikan ukurannya agar pas di kanvas, dan tetap bebas
                  digeser setelahnya.
                </p>
              </div>
            </div>
          )}

          {activeTab === "algorithms" && (
            <div className="space-y-3 text-sm text-slate-600">
              <div className="p-3 bg-teal-50/60 rounded-lg border border-teal-200">
                <strong className="text-teal-900 block mb-1">🔵 Tabu Search (TS)</strong>
                <p>
                  Metode pencarian lingkungan lokal (2-OPT) dengan memori tabu. Memilih kandidat
                  tetangga eligible terbaik pada setiap iterasi meskipun nilainya lebih buruk (untuk
                  keluar dari local optima).
                </p>
                <ul className="list-disc inside mt-1.5 text-xs text-teal-800 space-y-0.5">
                  <li>
                    <strong>Tabu Tenure:</strong> Durasi (jumlah iterasi) segmen rute yang dibalik
                    dilarang dibalik kembali.
                  </li>
                  <li>
                    <strong>Aspiration Criteria:</strong> Mengizinkan langkah tabu jika solusi
                    tersebut mengalahkan solusi terbaik global (best-so-far).
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200">
                <strong className="text-amber-900 block mb-1">🟠 Simulated Annealing (SA)</strong>
                <p>
                  Mengadopsi proses pendinginan termal logam. Selalu menerima rute yang lebih baik
                  (Δ &lt; 0), dan menerima rute yang lebih buruk dengan probabilitas{" "}
                  <code>P = exp(-Δ / T)</code>.
                </p>
                <ul className="list-disc inside mt-1.5 text-xs text-amber-800 space-y-0.5">
                  <li>
                    <strong>Suhu Awal (T₀):</strong> Temperatur awal eksplorasi (suhu tinggi =
                    toleransi solusi buruk lebih besar).
                  </li>
                  <li>
                    <strong>Cooling Rate (α):</strong> Laju penurunan suhu geometrik (misal 0.95).
                  </li>
                  <li>
                    <strong>Seed:</strong> Mengontrol generator angka acak agar hasil keputusan
                    dapat direproduksi persis.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "report" && (
            <div className="space-y-3 text-sm text-slate-600">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-slate-800 block mb-1">📊 Leaderboard Komparasi</strong>
                <p>
                  Membandingkan seluruh run yang pernah dijalankan berdampingan. Menampilkan Jarak
                  Awal vs Jarak Terbaik, persentase peningkatan, waktu komputasi, dan parameter.
                  Anda dapat menghapus run individual atau membersihkan seluruh riwayat.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-slate-800 block mb-1">
                  📈 Analisis Konvergensi & Trace
                </strong>
                <p>
                  Grafik konvergensi menampilkan penurunan biaya rute seiring berjalannya iterasi.
                  Tabel trace memungkinkan penelusuran keputusan algoritma langkah demi langkah.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-slate-800 block mb-1">📥 Ekspor Laporan</strong>
                <p>
                  Hasil perbandingan dapat diunduh dalam format <strong>CSV</strong> (untuk
                  spreadsheet) atau <strong>JSON</strong> (memuat seluruh detail trace untuk
                  dokumentasi tugas/laporan).
                </p>
              </div>
            </div>
          )}

          {activeTab === "theory" && (
            <div className="space-y-3 text-sm text-slate-600">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-slate-800 block mb-1">📐 Jarak Euclidean Planar</strong>
                <p>
                  Jarak antara dua kota <code>A(x₁, y₁)</code> dan <code>B(x₂, y₂)</code> dihitung
                  menggunakan rumus:
                </p>
                <code className="block bg-white p-2 rounded border border-slate-200 text-xs font-mono my-1 text-teal-800">
                  d(A, B) = √((x₂ - x₁)² + (y₂ - y₁)²)
                </code>
                <p className="text-xs text-slate-500">
                  Matriks jarak bersifat simetris dengan diagonal nol (jarak ke diri sendiri = 0).
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-slate-800 block mb-1">
                  🔄 Rute Tertutup (Closed Tour)
                </strong>
                <p>
                  Traveling Salesman Problem mensyaratkan setiap kota dikunjungi tepat satu kali dan
                  kembali ke kota awal (misal: <code>A → B → C → D → E → F → A</code>).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button size="sm" onClick={onClose}>
            Mengerti & Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}
