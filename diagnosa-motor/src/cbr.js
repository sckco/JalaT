// Mesin Case-Based Reasoning / Nearest Neighbor.
// Murni perhitungan: modul ini tidak boleh menyentuh DOM.

import { CASES, LABELS, WEIGHTS } from "./data.js";

/**
 * @typedef {object} DetailRow
 * @property {string} code
 * @property {string} label
 * @property {number} weight
 * @property {boolean} inInput
 * @property {boolean} inCase
 * @property {boolean} matched
 */

/**
 * @typedef {object} DiagnosisResult
 * @property {string} caseCode
 * @property {string} caseName
 * @property {number} similarity
 * @property {number} percentage
 * @property {number} matchedCount
 * @property {number} totalCompared
 * @property {string} solution
 * @property {string[]} union           gejala input ∪ gejala kasus
 * @property {string[]} matched         gejala yang cocok
 * @property {string[]} caseSymptoms    gejala milik kasus
 * @property {number} numeratorWeight   total bobot gejala cocok
 * @property {number} denominatorWeight total bobot gabungan
 * @property {DetailRow[]} rows         baris tabel rincian
 */

const weightOf = (code) => WEIGHTS[code] ?? 0;

/**
 * Hitung kemiripan input pengguna terhadap setiap kasus.
 * similarity = total bobot gejala cocok ÷ total bobot gabungan (input ∪ kasus).
 *
 * @param {Iterable<string>} selectedSet kode gejala yang dipilih pengguna
 * @returns {DiagnosisResult[]} hasil terurut menurun
 */
export function diagnose(selectedSet) {
  const selected = new Set(selectedSet ?? []);

  return CASES.map((item) => {
    const caseSymptoms = item.symptoms ?? [];
    const union = [...new Set([...selected, ...caseSymptoms])];
    const matched = union.filter((code) => selected.has(code) && caseSymptoms.includes(code));

    const denominatorWeight = union.reduce((sum, code) => sum + weightOf(code), 0);
    const numeratorWeight = matched.reduce((sum, code) => sum + weightOf(code), 0);

    // Pembagi nol (atau data bobot tidak valid) menghasilkan 0, bukan NaN.
    const similarity =
      Number.isFinite(denominatorWeight) && denominatorWeight > 0
        ? numeratorWeight / denominatorWeight
        : 0;

    /** @type {DetailRow[]} */
    const rows = union.map((code) => ({
      code,
      label: LABELS[code] ?? "",
      weight: weightOf(code),
      inInput: selected.has(code),
      inCase: caseSymptoms.includes(code),
      matched: selected.has(code) && caseSymptoms.includes(code),
    }));

    /** @type {DiagnosisResult} */
    const result = {
      caseCode: item.code,
      caseName: item.name,
      similarity,
      percentage: similarity * 100,
      matchedCount: matched.length,
      totalCompared: union.length,
      solution: item.solution,
      union,
      matched,
      caseSymptoms,
      numeratorWeight,
      denominatorWeight,
      rows,
    };
    return result;
  }).sort(
    (a, b) =>
      b.similarity - a.similarity ||
      b.matchedCount - a.matchedCount ||
      a.caseCode.localeCompare(b.caseCode),
  );
}
