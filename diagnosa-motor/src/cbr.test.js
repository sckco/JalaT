import { describe, it, expect } from "vitest";
import { diagnose, findTieGroups, normalizeCaseSymptoms, MIN_CONFIDENCE } from "./cbr.js";
import { validateData, CASES, SYMPTOMS, WEIGHTS } from "./data.js";

describe("Mesin CBR & Algoritma Nearest Neighbor", () => {
  it("Input kosong: tidak error, semua similarity bernilai 0 (bukan NaN)", () => {
    const results = diagnose([]);
    expect(results).toHaveLength(CASES.length);
    for (const r of results) {
      expect(r.similarity).toBe(0);
      expect(r.percentage).toBe(0);
      expect(Number.isNaN(r.similarity)).toBe(false);
      expect(Number.isNaN(r.percentage)).toBe(false);
    }
  });

  it("G01+G06+G09: K05 di urutan teratas dengan percentage tepat 100", () => {
    const results = diagnose(["G01", "G06", "G09"]);
    expect(results[0].caseCode).toBe("K05");
    expect(results[0].caseName).toBe("Sistem CVT / Transmisi");
    expect(results[0].similarity).toBe(1);
    expect(results[0].percentage).toBe(100);
    expect(results[0].solution).toBeTruthy();
  });

  it("G01+G02: semua K01–K05 muncul, urut menurun, tidak ada NaN", () => {
    const results = diagnose(["G01", "G02"]);
    expect(results).toHaveLength(CASES.length);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      expect(Number.isNaN(r.similarity)).toBe(false);
      expect(Number.isNaN(r.percentage)).toBe(false);
      expect(r.percentage).toBeGreaterThanOrEqual(0);
      expect(r.percentage).toBeLessThanOrEqual(100);

      if (i > 0) {
        expect(r.similarity).toBeLessThanOrEqual(results[i - 1].similarity);
      }
    }
  });

  it("Skor seri: urutan deterministik (matchedCount lalu kode kasus)", () => {
    // 1. Kasus dengan similarity sama dan matchedCount sama: diurutkan berdasarkan kode kasus
    const customSymptoms = [
      { code: "G01", label: "Gejala 1", weight: 0.5 },
    ];
    const customCases = [
      {
        code: "K02_B",
        name: "Kasus B",
        urgency: "tunda",
        symptoms: [{ code: "G01", weight: 0.5 }],
        solution: "Solusi B",
      },
      {
        code: "K01_A",
        name: "Kasus A",
        urgency: "tunda",
        symptoms: [{ code: "G01", weight: 0.5 }],
        solution: "Solusi A",
      },
    ];

    const results = diagnose(["G01"], customCases, customSymptoms);
    expect(results[0].similarity).toBe(results[1].similarity);
    expect(results[0].matchedCount).toBe(results[1].matchedCount);
    expect(results[0].caseCode).toBe("K01_A");
    expect(results[1].caseCode).toBe("K02_B");

    // 2. Kasus dengan similarity sama tapi matchedCount berbeda: matchedCount lebih besar harus di atas
    const symList = [
      { code: "G01", label: "G1", weight: 0.5 },
      { code: "G02", label: "G2", weight: 0.5 },
      { code: "G03", label: "G3", weight: 1.0 },
    ];
    // Kasus 1: punya G01, G02 (total 1.0). Input G01, G02 -> matched = 2, numerator = 1.0, denominator = 1.0 -> sim = 1.0
    // Kasus 2: punya G03 (total 1.0). Input G03 -> matched = 1, numerator = 1.0, denominator = 1.0 -> sim = 1.0
    // Bila input: G01, G02, G03
    // Kasus 1: union G01, G02, G03 (weight 0.5+0.5+1.0 = 2.0). Matched G01, G02 (0.5+0.5 = 1.0). Sim = 1.0/2.0 = 0.5. matchedCount = 2.
    // Kasus 2: union G01, G02, G03 (weight 2.0). Matched G03 (1.0). Sim = 1.0/2.0 = 0.5. matchedCount = 1.
    const casesCountDiff = [
      {
        code: "K_LOW",
        name: "Matched 1",
        urgency: "tunda",
        symptoms: [{ code: "G03" }],
        solution: "S1",
      },
      {
        code: "K_HIGH",
        name: "Matched 2",
        urgency: "tunda",
        symptoms: [{ code: "G01" }, { code: "G02" }],
        solution: "S2",
      },
    ];
    const resCountDiff = diagnose(["G01", "G02", "G03"], casesCountDiff, symList);
    expect(resCountDiff[0].similarity).toBe(0.5);
    expect(resCountDiff[1].similarity).toBe(0.5);
    expect(resCountDiff[0].matchedCount).toBe(2);
    expect(resCountDiff[1].matchedCount).toBe(1);
    expect(resCountDiff[0].caseCode).toBe("K_HIGH");
  });

  it("Bobot per pasangan: perubahan bobot pasangan mengubah skor sesuai hitungan manual", () => {
    const customSymptoms = [
      { code: "G01", label: "Gejala 1", weight: 0.5 },
      { code: "G02", label: "Gejala 2", weight: 0.5 },
    ];

    // Kasus 1 memakai bobot default global (0.5 dan 0.5).
    // Input: G01. Union: G01, G02 (bobot 0.5 + 0.5 = 1.0). Matched: G01 (0.5). Sim = 0.5 / 1.0 = 0.5 (50%).
    const casesDefault = [
      {
        code: "K_TEST",
        name: "Uji Bobot",
        urgency: "tunda",
        symptoms: [{ code: "G01" }, { code: "G02" }],
        solution: "Solusi",
      },
    ];
    const resDefault = diagnose(["G01"], casesDefault, customSymptoms);
    expect(resDefault[0].similarity).toBeCloseTo(0.5, 4);

    // Kasus 2 menimpa bobot pasangan G01 menjadi 0.9.
    // Input: G01. Union: G01 (bobot 0.9), G02 (bobot 0.5) -> Denominator = 0.9 + 0.5 = 1.4.
    // Matched: G01 (bobot 0.9) -> Numerator = 0.9.
    // Hitungan manual: 0.9 / 1.4 = 0.642857... (~64.29%)
    const casesOverridden = [
      {
        code: "K_TEST",
        name: "Uji Bobot",
        urgency: "tunda",
        symptoms: [{ code: "G01", weight: 0.9 }, { code: "G02" }],
        solution: "Solusi",
      },
    ];
    const resOverridden = diagnose(["G01"], casesOverridden, customSymptoms);
    expect(resOverridden[0].similarity).toBeCloseTo(0.9 / 1.4, 4);
    expect(resOverridden[0].percentage).toBeCloseTo((0.9 / 1.4) * 100, 2);
    // Verifikasi row tabel rincian memakai bobot 0.9 untuk G01
    const g01Row = resOverridden[0].rows.find((r) => r.code === "G01");
    expect(g01Row.weight).toBe(0.9);
  });

  it("Validasi data: data rusak ditolak", () => {
    // 1. Data normal valid
    const normal = validateData(SYMPTOMS, CASES);
    expect(normal.valid).toBe(true);
    expect(normal.errors).toHaveLength(0);

    // 2. Kode gejala duplikat di symptoms
    const dupSymptoms = [
      { code: "G01", label: "A", weight: 0.5 },
      { code: "G01", label: "B", weight: 0.5 },
    ];
    const dupSymCheck = validateData(dupSymptoms, []);
    expect(dupSymCheck.valid).toBe(false);
    expect(dupSymCheck.errors.some((e) => e.includes("duplikat"))).toBe(true);

    // 3. Bobot di luar 0 s.d 1
    const invalidWeightSym = [
      { code: "G01", label: "A", weight: 1.5 },
    ];
    const invalidWeightCheck = validateData(invalidWeightSym, []);
    expect(invalidWeightCheck.valid).toBe(false);
    expect(invalidWeightCheck.errors.some((e) => e.includes("0 sampai 1"))).toBe(true);

    // 4. Kasus merujuk ke gejala yang tidak ada
    const unknownSymCase = [
      {
        code: "K99",
        name: "Kasus Fiktif",
        symptoms: [{ code: "G99_TIDAK_ADA", weight: 0.5 }],
        solution: "Solusi",
      },
    ];
    const unknownSymCheck = validateData(SYMPTOMS, unknownSymCase);
    expect(unknownSymCheck.valid).toBe(false);
    expect(unknownSymCheck.errors.some((e) => e.includes("tidak terdaftar"))).toBe(true);

    // 5. Kode kasus duplikat
    const dupCases = [
      { code: "K01", name: "Kasus 1", symptoms: [{ code: "G01" }], solution: "A" },
      { code: "K01", name: "Kasus 1 Duplikat", symptoms: [{ code: "G01" }], solution: "B" },
    ];
    const dupCaseCheck = validateData(SYMPTOMS, dupCases);
    expect(dupCaseCheck.valid).toBe(false);
    expect(dupCaseCheck.errors.some((e) => e.includes("Kode kasus duplikat"))).toBe(true);
  });

  it("Fase 1: Deteksi seri (findTieGroups) dan ambang kepercayaan (MIN_CONFIDENCE)", () => {
    expect(MIN_CONFIDENCE).toBe(40);

    // Input G03, G04, G10 diketahui menghasilkan skor seri antara K01 dan K03
    const results = diagnose(["G03", "G04", "G10"]);
    const tieMap = findTieGroups(results, ["G03", "G04", "G10"]);
    expect(tieMap.size).toBeGreaterThan(0);
    const k01Tie = tieMap.get("K01");
    expect(k01Tie).toBeDefined();
    expect(k01Tie.isTie).toBe(true);
    expect(k01Tie.distinguishing.length).toBeGreaterThanOrEqual(1);
  });
});
