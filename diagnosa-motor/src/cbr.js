// Mesin Case-Based Reasoning / Nearest Neighbor.
// Murni modul perhitungan: modul ini tidak boleh menyentuh DOM.

import { CASES, SYMPTOMS, WEIGHTS, LABELS } from "./data.js";

/** Ambang batas kepercayaan minimal (dalam persen). Di bawah ini dianggap belum cukup spesifik. */
export const MIN_CONFIDENCE = 40;

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
 * @property {"tunda" | "segera" | "jangan-dikendarai"} urgency
 * @property {string} warning
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

/**
 * Normalisasi relasi gejala kasus menjadi Map<string, number> (kode -> bobot efektif).
 * Kompatibel mundur dengan string array maupun array objek { code, weight }.
 *
 * @param {(string | { code: string, weight?: number })[]} symptomsList
 * @param {Record<string, number>} globalWeights
 * @returns {Map<string, number>}
 */
export function normalizeCaseSymptoms(symptomsList, globalWeights = WEIGHTS) {
  const map = new Map();
  if (!Array.isArray(symptomsList)) return map;

  for (const item of symptomsList) {
    if (typeof item === "string") {
      map.set(item, globalWeights[item] ?? 0);
    } else if (item && typeof item === "object") {
      const code = item.code;
      const weight = item.weight !== undefined ? item.weight : (globalWeights[code] ?? 0);
      map.set(code, weight);
    }
  }
  return map;
}

/**
 * Deteksi skor seri antar hasil diagnosa dan cari gejala yang paling membedakan.
 *
 * @param {DiagnosisResult[]} results hasil diagnosa
 * @param {Iterable<string>} selectedSet gejala yang dipilih pengguna
 * @param {object} [symptomMetadata]
 * @param {Record<string, number>} [symptomMetadata.weights]
 * @param {Record<string, string>} [symptomMetadata.labels]
 * @returns {Map<string, { isTie: boolean, distinguishing: Array<{code: string, label: string}> }>}
 */
export function findTieGroups(results, selectedSet, symptomMetadata = {}) {
  const selected = new Set(selectedSet ?? []);
  const weights = symptomMetadata.weights ?? WEIGHTS;
  const labels = symptomMetadata.labels ?? LABELS;
  const tieMap = new Map();

  // Kelompokkan hasil yang memiliki similarity sama (selisih < 0.0001) dan similarity > 0
  const groups = [];
  for (const r of results) {
    if (r.similarity <= 0) continue;
    let group = groups.find((g) => Math.abs(g[0].similarity - r.similarity) < 0.0001);
    if (group) {
      group.push(r);
    } else {
      groups.push([r]);
    }
  }

  for (const g of groups) {
    if (g.length > 1) {
      const symptomCounts = new Map();
      const allSymptomsInGroup = new Set();
      for (const r of g) {
        for (const sym of r.caseSymptoms) {
          allSymptomsInGroup.add(sym);
          symptomCounts.set(sym, (symptomCounts.get(sym) || 0) + 1);
        }
      }

      // Gejala pembeda: gejala yang muncul di sebagian kasus dalam grup dan belum dipilih user
      const distinguishingCodes = [...allSymptomsInGroup].filter(
        (code) => !selected.has(code) && (symptomCounts.get(code) || 0) < g.length,
      );

      // Urutkan berdasarkan bobot tertinggi
      distinguishingCodes.sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
      const topDistinguishing = distinguishingCodes.slice(0, 3).map((code) => ({
        code,
        label: labels[code] ?? code,
      }));

      for (const r of g) {
        tieMap.set(r.caseCode, {
          isTie: true,
          distinguishing: topDistinguishing,
        });
      }
    }
  }

  return tieMap;
}

/**
 * Hitung kemiripan input pengguna terhadap setiap kasus.
 * similarity = total bobot gejala cocok ÷ total bobot gabungan (input ∪ kasus).
 *
 * @param {Iterable<string>} selectedSet kode gejala yang dipilih pengguna
 * @param {any[]} [casesList] basis kasus yang dipakai (default: CASES)
 * @param {any[]} [symptomsList] daftar gejala yang dipakai (default: SYMPTOMS)
 * @returns {DiagnosisResult[]} hasil terurut menurun
 */
export function diagnose(selectedSet, casesList = CASES, symptomsList = SYMPTOMS) {
  const selected = new Set(selectedSet ?? []);
  const globalWeights = Object.fromEntries((symptomsList ?? []).map((s) => [s.code, s.weight]));
  const labelsMap = Object.fromEntries((symptomsList ?? []).map((s) => [s.code, s.label]));

  const globalWeightOf = (code) => globalWeights[code] ?? 0;

  return casesList.map((item) => {
    const caseSymptomWeights = normalizeCaseSymptoms(item.symptoms, globalWeights);
    const caseSymptoms = Array.from(caseSymptomWeights.keys());

    const union = [...new Set([...selected, ...caseSymptoms])];
    const matched = union.filter((code) => selected.has(code) && caseSymptomWeights.has(code));

    // Bobot tiap gejala dalam perhitungan sebuah kasus diambil dari bobot pasangan gejala-kasus itu.
    // Untuk gejala input yang tidak ada di kasus tersebut, pakai bobot global.
    const getEffectiveWeight = (code) => {
      if (caseSymptomWeights.has(code)) {
        return caseSymptomWeights.get(code);
      }
      return globalWeightOf(code);
    };

    const denominatorWeight = union.reduce((sum, code) => sum + getEffectiveWeight(code), 0);
    const numeratorWeight = matched.reduce((sum, code) => sum + getEffectiveWeight(code), 0);

    // Pembagi nol (atau data bobot tidak valid) menghasilkan 0, bukan NaN.
    const similarity =
      Number.isFinite(denominatorWeight) && denominatorWeight > 0
        ? numeratorWeight / denominatorWeight
        : 0;

    /** @type {DetailRow[]} */
    const rows = union.map((code) => ({
      code,
      label: labelsMap[code] ?? "",
      weight: getEffectiveWeight(code),
      inInput: selected.has(code),
      inCase: caseSymptomWeights.has(code),
      matched: selected.has(code) && caseSymptomWeights.has(code),
    }));

    /** @type {DiagnosisResult} */
    const result = {
      caseCode: item.code,
      caseName: item.name,
      urgency: item.urgency ?? "tunda",
      warning: item.warning ?? "",
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
