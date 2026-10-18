import { describe, expect, test } from "bun:test";
import {
  EXAMPLE,
  validateDataset,
  validateWorkingDataset,
  type Dataset,
  type TspNode,
} from "../../src/domain/tsp/model";
import {
  parseManualInputDraft,
  getNextAvailableNodeId,
  parseCoordinate,
  type ManualInputRowDraft,
} from "../../src/domain/tsp/manualInput";
import { workspaceReducer, type Workspace } from "../../src/app/workspace";
import { defaultConfig, type RunResult } from "../../src/domain/algorithms/experiment";
import { parseSession } from "../../src/services/storage";

describe("manual node input parser and batch validation", () => {
  test("parseCoordinate membedakan angka valid, kosong, dan tidak valid", () => {
    expect(parseCoordinate("0")).toEqual({ num: 0, valid: true, empty: false });
    expect(parseCoordinate("-2.5")).toEqual({ num: -2.5, valid: true, empty: false });
    expect(parseCoordinate(" 14.75 ")).toEqual({ num: 14.75, valid: true, empty: false });
    expect(parseCoordinate("1e2")).toEqual({ num: 100, valid: true, empty: false });

    // Jangan konversi string kosong menjadi 0
    expect(parseCoordinate("").empty).toBe(true);
    expect(parseCoordinate("   ").empty).toBe(true);

    // Format salah (misal koma alih-alih titik, teks acak, infinity)
    expect(parseCoordinate("12,5").valid).toBe(false);
    expect(parseCoordinate("abc").valid).toBe(false);
    expect(parseCoordinate("Infinity").valid).toBe(false);
    expect(parseCoordinate("NaN").valid).toBe(false);
  });

  test("getNextAvailableNodeId menghasilkan urutan A-Z lalu N1, N2 menghindari reserved", () => {
    const reserved = new Set(["A", "B", "C"]);
    expect(getNextAvailableNodeId(reserved)).toBe("D");

    const allLetters = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
    expect(getNextAvailableNodeId(allLetters)).toBe("N1");

    allLetters.add("N1");
    expect(getNextAvailableNodeId(allLetters)).toBe("N2");
  });

  test("fixture 6 node ditambah 2 node menghasilkan 8 node dan 6 node sebelumnya tidak berubah", () => {
    const draft: ManualInputRowDraft[] = [
      { key: "1", id: "", x: "10", y: "20" },
      { key: "2", id: "", x: "15.5", y: "-5" },
    ];

    const result = parseManualInputDraft(draft, EXAMPLE);
    expect(result.success).toBe(true);
    expect(result.nodes.length).toBe(2);
    expect(result.totalAfterAddition).toBe(8);

    // 6 node lama EXAMPLE (A-F)
    expect(result.nodes[0]!.id).toBe("G");
    expect(result.nodes[0]!.x).toBe(10);
    expect(result.nodes[0]!.y).toBe(20);

    expect(result.nodes[1]!.id).toBe("H");
    expect(result.nodes[1]!.x).toBe(15.5);
    expect(result.nodes[1]!.y).toBe(-5);

    // Periksa bahwa 6 node awal tetap identik
    const combined = [...EXAMPLE.nodes, ...result.nodes];
    expect(combined.slice(0, 6)).toEqual(EXAMPLE.nodes);
  });

  test("ID otomatis menghindari node lama dan ID eksplisit pada baris sesudahnya", () => {
    // Row 1: ID kosong (harus menghindari 'G' yang diambil Row 2!)
    // Row 2: ID eksplisit 'G'
    const draft: ManualInputRowDraft[] = [
      { key: "1", id: "", x: "1", y: "1" },
      { key: "2", id: "G", x: "2", y: "2" },
      { key: "3", id: "", x: "3", y: "3" },
    ];

    const result = parseManualInputDraft(draft, EXAMPLE);
    expect(result.success).toBe(true);
    expect(result.nodes[0]!.id).toBe("H"); // Karena G direservasi oleh baris 2!
    expect(result.nodes[1]!.id).toBe("G");
    expect(result.nodes[2]!.id).toBe("I");
  });

  test("mengabaikan baris kosong, namun menolak jika semua baris kosong", () => {
    const draftWithBlank: ManualInputRowDraft[] = [
      { key: "1", id: "  ", x: "", y: "" },
      { key: "2", id: "Z", x: "1", y: "2" },
      { key: "3", id: "", x: "   ", y: "" },
    ];
    const res = parseManualInputDraft(draftWithBlank, EXAMPLE);
    expect(res.success).toBe(true);
    expect(res.nodes.length).toBe(1);
    expect(res.nodes[0]!.id).toBe("Z");

    const allBlank: ManualInputRowDraft[] = [
      { key: "1", id: "", x: "", y: "" },
      { key: "2", id: "  ", x: "  ", y: "" },
    ];
    const resAllBlank = parseManualInputDraft(allBlank, EXAMPLE);
    expect(resAllBlank.success).toBe(false);
    expect(resAllBlank.generalError).toContain("Isi minimal satu baris");
  });

  test("menolak baris tidak lengkap (ID terisi tapi X/Y kosong atau sebaliknya)", () => {
    const draft: ManualInputRowDraft[] = [{ key: "1", id: "NODE_X", x: "", y: "5" }];
    const res = parseManualInputDraft(draft, EXAMPLE);
    expect(res.success).toBe(false);
    expect(res.issues.some((i) => i.key === "1" && i.field === "x")).toBe(true);

    const draft2: ManualInputRowDraft[] = [{ key: "2", id: "", x: "10", y: "" }];
    const res2 = parseManualInputDraft(draft2, EXAMPLE);
    expect(res2.success).toBe(false);
    expect(res2.issues.some((i) => i.key === "2" && i.field === "y")).toBe(true);
  });

  test("menolak ID duplikat terhadap dataset dasar atau antardraft", () => {
    // A sudah ada di EXAMPLE
    const draftMatchBase: ManualInputRowDraft[] = [{ key: "1", id: "A", x: "1", y: "1" }];
    const resBase = parseManualInputDraft(draftMatchBase, EXAMPLE);
    expect(resBase.success).toBe(false);
    expect(
      resBase.issues.some((i) => i.field === "id" && i.message.includes("sudah digunakan")),
    ).toBe(true);

    // Duplikat dalam batch
    const draftMatchBatch: ManualInputRowDraft[] = [
      { key: "1", id: "K", x: "1", y: "1" },
      { key: "2", id: " K ", x: "2", y: "2" },
    ];
    const resBatch = parseManualInputDraft(draftMatchBatch, EXAMPLE);
    expect(resBatch.success).toBe(false);
    expect(
      resBatch.issues.some((i) => i.field === "id" && i.message.includes("lebih dari sekali")),
    ).toBe(true);
  });

  test("koordinat berimpit diperbolehkan", () => {
    // Titik sama dengan node A (0, 0)
    const draftCoincident: ManualInputRowDraft[] = [{ key: "1", id: "Z", x: "0", y: "0" }];
    const res = parseManualInputDraft(draftCoincident, EXAMPLE);
    expect(res.success).toBe(true);
    expect(res.nodes[0]!.id).toBe("Z");
    expect(res.nodes[0]!.x).toBe(0);
    expect(res.nodes[0]!.y).toBe(0);
  });

  test("batch bersifat atomik: jika satu baris invalid, tidak ada baris yang ditambahkan", () => {
    const draft: ManualInputRowDraft[] = [
      { key: "1", id: "VALID1", x: "1", y: "1" },
      { key: "2", id: "INVALID", x: "bukan_angka", y: "2" },
      { key: "3", id: "VALID2", x: "3", y: "3" },
    ];
    const res = parseManualInputDraft(draft, EXAMPLE);
    expect(res.success).toBe(false);
    expect(res.nodes).toEqual([]);
    expect(res.firstErrorKey).toBe("2");
  });

  test("batas total 100 node: tepat 100 diterima, melebihi 100 ditolak", () => {
    // Buat dataset dasar dengan 98 node
    const base98Nodes: TspNode[] = Array.from({ length: 98 }, (_, i) => ({
      id: `P${i + 1}`,
      x: i,
      y: i,
    }));
    const base98: Dataset = { ...EXAMPLE, nodes: base98Nodes };

    // Tambah 2 node -> 100 node (sukses)
    const draft2: ManualInputRowDraft[] = [
      { key: "1", id: "", x: "100", y: "100" },
      { key: "2", id: "", x: "101", y: "101" },
    ];
    const res100 = parseManualInputDraft(draft2, base98);
    expect(res100.success).toBe(true);
    expect(res100.totalAfterAddition).toBe(100);

    // Tambah 3 node -> 101 node (ditolak)
    const draft3: ManualInputRowDraft[] = [
      { key: "1", id: "", x: "100", y: "100" },
      { key: "2", id: "", x: "101", y: "101" },
      { key: "3", id: "", x: "102", y: "102" },
    ];
    const res101 = parseManualInputDraft(draft3, base98);
    expect(res101.success).toBe(false);
    expect(res101.generalError).toContain("melebihi batas maksimum 100 node");
  });

  test("koordinat overflow non-finite ditolak", () => {
    const draft: ManualInputRowDraft[] = [
      { key: "1", id: "FAR1", x: "1e308", y: "0" },
      { key: "2", id: "FAR2", x: "-1e308", y: "0" },
    ];
    const res = parseManualInputDraft(draft, EXAMPLE);
    expect(res.success).toBe(false);
    expect(res.generalError).toContain("jarak atau total rute melampaui batas angka");
  });
});

describe("workspaceReducer add_nodes transition", () => {
  const initialWorkspace: Workspace = {
    dataset: structuredClone(EXAMPLE),
    config: { ...defaultConfig, startId: "A" },
    runs: [],
    active: null,
    selectedId: null,
    phase: "idle",
    runId: null,
    error: null,
  };

  test("add_nodes menambahkan node baru secara atomik dan memperbarui startId", () => {
    const newNodes: TspNode[] = [
      { id: "G", x: 10, y: 12 },
      { id: "H", x: -4, y: 8 },
    ];

    const nextState = workspaceReducer(initialWorkspace, {
      type: "add_nodes",
      nodes: newNodes,
    });

    expect(nextState.dataset.nodes.length).toBe(8);
    expect(nextState.dataset.nodes.slice(0, 6)).toEqual(EXAMPLE.nodes);
    expect(nextState.dataset.nodes.slice(6)).toEqual(newNodes);
    expect(nextState.config.startId).toBe("A"); // StartId tetap A karena masih valid
  });

  test("kanvas kosong disusun menjadi satu lalu dua node", () => {
    const emptyWorkspace: Workspace = {
      ...initialWorkspace,
      dataset: { ...EXAMPLE, nodes: [] },
      config: { ...defaultConfig, startId: "" },
    };

    // Tambah 1 node
    const node1: TspNode = { id: "A", x: 0, y: 0 };
    const state1 = workspaceReducer(emptyWorkspace, {
      type: "add_nodes",
      nodes: [node1],
    });
    expect(state1.dataset.nodes.length).toBe(1);
    expect(state1.config.startId).toBe("A");
    expect(validateWorkingDataset(state1.dataset)).toEqual([]);
    expect(validateDataset(state1.dataset).length).toBeGreaterThan(0); // Belum 3 node

    // Tambah node kedua
    const node2: TspNode = { id: "B", x: 5, y: 5 };
    const state2 = workspaceReducer(state1, {
      type: "add_nodes",
      nodes: [node2],
    });
    expect(state2.dataset.nodes.length).toBe(2);
    expect(state2.config.startId).toBe("A");
    expect(validateWorkingDataset(state2.dataset)).toEqual([]);
    expect(validateDataset(state2.dataset).length).toBeGreaterThan(0); // Belum 3 node

    // Tambah node ketiga -> siap optimasi
    const node3: TspNode = { id: "C", x: 10, y: 0 };
    const state3 = workspaceReducer(state2, {
      type: "add_nodes",
      nodes: [node3],
    });
    expect(state3.dataset.nodes.length).toBe(3);
    expect(validateDataset(state3.dataset)).toEqual([]); // Sekarang siap optimasi
  });

  test("penambahan dari run historis menghasilkan dataset cabang tanpa memutasi snapshot", () => {
    const mockRun: RunResult = {
      id: "run-hist",
      createdAt: new Date().toISOString(),
      dataset: structuredClone(EXAMPLE),
      config: { ...defaultConfig, startId: "B" },
      initialRoute: [1, 2, 3, 4, 5, 0],
      currentRoute: [1, 2, 3, 4, 5, 0],
      bestRoute: [1, 2, 3, 4, 5, 0],
      initialCost: 25,
      currentCost: 24,
      bestCost: 24,
      durationMs: 10,
      iterations: 5,
      evaluations: 10,
      stopReason: "completed",
      status: "completed",
      category: "metaheuristic",
      trace: [],
    };

    const stateWithRun: Workspace = {
      ...initialWorkspace,
      runs: [mockRun],
      selectedId: mockRun.id,
    };

    const newNodes: TspNode[] = [{ id: "G", x: 9, y: 9 }];
    const nextState = workspaceReducer(stateWithRun, {
      type: "add_nodes",
      nodes: newNodes,
      sourceDataset: mockRun.dataset,
      isHistoricalSnapshot: true,
      snapshotStartId: mockRun.config.startId,
    });

    // Run snapshot historis tetap utuh 6 node
    expect(nextState.runs[0]!.dataset.nodes.length).toBe(6);
    expect(nextState.runs[0]!.dataset.id).toBe(EXAMPLE.id);

    // Dataset aktif bercabang dan memiliki 7 node
    expect(nextState.dataset.nodes.length).toBe(7);
    expect(nextState.dataset.id).not.toBe(EXAMPLE.id);
    expect(nextState.dataset.provenance).toContain("Bercabang dari");
    expect(nextState.selectedId).toBeNull();
    expect(nextState.active).toBeNull();
    expect(nextState.config.startId).toBe("B"); // Mengikuti startId snapshot
  });
});

describe("session parsing dengan incomplete dataset", () => {
  test("parseSession memulihkan dataset kerja dengan 1 atau 2 node", () => {
    const session1Node = {
      version: 2,
      dataset: {
        id: "d1",
        name: "Kerja 1 Node",
        unit: "unit",
        provenance: "Uji coba",
        nodes: [{ id: "A", x: 0, y: 0 }],
      },
      config: { ...defaultConfig, startId: "A" },
      runs: [],
    };

    const parsed = parseSession(session1Node);
    expect(parsed.dataset.nodes.length).toBe(1);
    expect(parsed.config.startId).toBe("A");

    const sessionEmpty = {
      version: 2,
      dataset: {
        id: "d0",
        name: "Kosong",
        unit: "unit",
        provenance: "Uji coba",
        nodes: [],
      },
      config: { ...defaultConfig, startId: "" },
      runs: [],
    };
    const parsedEmpty = parseSession(sessionEmpty);
    expect(parsedEmpty.dataset.nodes.length).toBe(0);
  });

  test("parseSession tetap menolak riwayat run yang dataset-nya kurang dari 3 node", () => {
    const sessionInvalidRun = {
      version: 2,
      dataset: structuredClone(EXAMPLE),
      config: { ...defaultConfig, startId: "A" },
      runs: [
        {
          id: "r1",
          createdAt: new Date().toISOString(),
          dataset: {
            ...EXAMPLE,
            nodes: [
              { id: "A", x: 0, y: 0 },
              { id: "B", x: 1, y: 1 },
            ],
          }, // Kurang dari 3 node di riwayat run!
          config: { ...defaultConfig, startId: "A" },
          initialRoute: [0, 1],
          currentRoute: [0, 1],
          bestRoute: [0, 1],
          initialCost: 1,
          currentCost: 1,
          bestCost: 1,
          durationMs: 1,
          iterations: 0,
          evaluations: 0,
          stopReason: "completed",
          status: "completed",
          category: "metaheuristic",
          trace: [],
        },
      ],
    };

    expect(() => parseSession(sessionInvalidRun)).toThrow("Riwayat tersimpan tidak valid");
  });
});
