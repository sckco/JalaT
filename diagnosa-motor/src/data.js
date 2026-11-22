// Data statis sisi klien diimpor dari file JSON di folder data/.
// Mekanik dapat mengedit file JSON data/symptoms.json dan data/cases.json tanpa menyentuh logika.

import rawSymptoms from "../data/symptoms.json" with { type: "json" };
import rawCases from "../data/cases.json" with { type: "json" };

/**
 * @typedef {{
 *   code: string,
 *   label: string,
 *   weight: number,
 *   group?: string,
 *   aliases?: string[]
 * }} Symptom
 */

/**
 * @typedef {{
 *   code: string,
 *   weight?: number
 * }} CaseSymptomRelation
 */

/**
 * @typedef {{
 *   code: string,
 *   name: string,
 *   solution: string,
 *   symptoms: (string | CaseSymptomRelation)[],
 *   urgency: "tunda" | "segera" | "jangan-dikendarai",
 *   warning?: string
 * }} CaseItem
 */

/**
 * Validasi integritas data basis pengetahuan (CBR).
 *
 * Aturan validasi:
 * 1. symptoms dan cases harus berupa array.
 * 2. Kode gejala unik, tidak boleh duplikat.
 * 3. Bobot gejala harus angka antara 0 sampai 1.
 * 4. Kode kasus unik, tidak boleh duplikat.
 * 5. Setiap kode gejala di dalam kasus harus terdaftar di daftar gejala.
 * 6. Tidak boleh ada kode gejala duplikat di dalam satu kasus.
 * 7. Bobot per pasangan (bila ada) harus angka antara 0 sampai 1.
 *
 * @param {any[]} symptoms
 * @param {any[]} cases
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateData(symptoms, cases) {
  const errors = [];

  if (!Array.isArray(symptoms)) {
    errors.push("Daftar gejala (symptoms) harus berupa array.");
    return { valid: false, errors };
  }

  if (!Array.isArray(cases)) {
    errors.push("Basis kasus (cases) harus berupa array.");
    return { valid: false, errors };
  }

  const symptomCodes = new Set();
  symptoms.forEach((s, idx) => {
    if (!s || typeof s !== "object") {
      errors.push(`Gejala pada indeks ${idx} tidak valid.`);
      return;
    }
    if (!s.code || typeof s.code !== "string" || !s.code.trim()) {
      errors.push(`Gejala indeks ${idx} tidak memiliki kode yang sah.`);
    } else {
      if (symptomCodes.has(s.code)) {
        errors.push(`Kode gejala duplikat ditemukan: "${s.code}".`);
      }
      symptomCodes.add(s.code);
    }

    if (typeof s.weight !== "number" || Number.isNaN(s.weight) || s.weight < 0 || s.weight > 1) {
      errors.push(`Bobot gejala "${s.code || idx}" harus berada di rentang 0 sampai 1 (ditemukan: ${s.weight}).`);
    }
  });

  const caseCodes = new Set();
  cases.forEach((c, idx) => {
    if (!c || typeof c !== "object") {
      errors.push(`Kasus pada indeks ${idx} tidak valid.`);
      return;
    }
    if (!c.code || typeof c.code !== "string" || !c.code.trim()) {
      errors.push(`Kasus indeks ${idx} tidak memiliki kode yang sah.`);
    } else {
      if (caseCodes.has(c.code)) {
        errors.push(`Kode kasus duplikat ditemukan: "${c.code}".`);
      }
      caseCodes.add(c.code);
    }

    if (!Array.isArray(c.symptoms)) {
      errors.push(`Kasus "${c.code || idx}" tidak memiliki daftar gejala (symptoms) yang sah.`);
      return;
    }

    const localSymptomCodes = new Set();
    c.symptoms.forEach((symRel, sIdx) => {
      let code = "";
      let weight = undefined;

      if (typeof symRel === "string") {
        code = symRel;
      } else if (symRel && typeof symRel === "object") {
        code = symRel.code;
        weight = symRel.weight;
      } else {
        errors.push(`Relasi gejala indeks ${sIdx} pada kasus "${c.code}" tidak sah.`);
        return;
      }

      if (!code || typeof code !== "string") {
        errors.push(`Kode gejala indeks ${sIdx} pada kasus "${c.code}" kosong.`);
        return;
      }

      if (!symptomCodes.has(code)) {
        errors.push(`Kode gejala "${code}" pada kasus "${c.code}" tidak terdaftar di daftar gejala.`);
      }

      if (localSymptomCodes.has(code)) {
        errors.push(`Kode gejala "${code}" duplikat di dalam kasus "${c.code}".`);
      }
      localSymptomCodes.add(code);

      if (weight !== undefined) {
        if (typeof weight !== "number" || Number.isNaN(weight) || weight < 0 || weight > 1) {
          errors.push(`Bobot pasangan gejala "${code}" pada kasus "${c.code}" harus antara 0 dan 1 (ditemukan: ${weight}).`);
        }
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Jalankan validasi awal
export const initialValidation = validateData(rawSymptoms, rawCases);
if (!initialValidation.valid) {
  console.error("Validasi data basis pengetahuan JalaT gagal:\n" + initialValidation.errors.join("\n"));
}

/** @type {Symptom[]} */
export const SYMPTOMS = rawSymptoms;

/** @type {CaseItem[]} */
export const CASES = rawCases;

/** Peta kode gejala → bobot global default */
export const WEIGHTS = Object.fromEntries(SYMPTOMS.map((s) => [s.code, s.weight]));

/** Peta kode gejala → deskripsi label */
export const LABELS = Object.fromEntries(SYMPTOMS.map((s) => [s.code, s.label]));
