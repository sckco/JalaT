// Data statis sisi klien: gejala (G01–G10) dan basis kasus (K01–K05).
// Tidak ada data pribadi, tidak ada akses jaringan, tidak ada penyimpanan.

/** @typedef {{ code: string, label: string, weight: number }} Symptom */
/** @typedef {{ code: string, name: string, solution: string, symptoms: string[] }} CaseItem */

/** @type {Symptom[]} */
export const SYMPTOMS = [
  { code: "G01", label: "Tenaga motor loyo, tarikan terasa berat", weight: 0.7 },
  { code: "G02", label: "Mesin sulit dihidupkan", weight: 0.8 },
  { code: "G03", label: "Mesin brebet atau busi sering basah", weight: 0.6 },
  { code: "G04", label: "Lampu redup, aki cepat habis", weight: 0.5 },
  { code: "G05", label: "Knalpot mengeluarkan asap putih atau hitam", weight: 0.7 },
  { code: "G06", label: "Bunyi kasar atau berdecit dari area CVT", weight: 0.8 },
  { code: "G07", label: "Mesin cepat panas (overheat)", weight: 0.8 },
  { code: "G08", label: "Bahan bakar boros", weight: 0.5 },
  { code: "G09", label: "Getaran atau hentakan saat gas awal", weight: 0.7 },
  { code: "G10", label: "Oli cepat berkurang atau ada rembesan", weight: 0.6 },
];

/** @type {CaseItem[]} */
export const CASES = [
  {
    code: "K01",
    name: "Sistem Pengapian",
    symptoms: ["G02", "G03", "G08"],
    solution:
      "Periksa busi, koil, dan CDI. Bersihkan atau ganti busi, lalu cek tegangan koil.",
  },
  {
    code: "K02",
    name: "Sistem Bahan Bakar",
    symptoms: ["G01", "G02", "G03", "G08"],
    solution:
      "Cek filter bensin, pompa bahan bakar, dan injektor atau karburator. Bersihkan saluran yang tersumbat.",
  },
  {
    code: "K03",
    name: "Sistem Kelistrikan / Aki",
    symptoms: ["G02", "G04"],
    solution:
      "Ukur tegangan aki dan cek kiprok serta spul. Ganti aki bila tegangan tidak stabil.",
  },
  {
    code: "K04",
    name: "Sistem Pendinginan / Pelumasan",
    symptoms: ["G05", "G07", "G10"],
    solution:
      "Periksa level oli dan cairan pendingin, cek seal, dan ganti oli sesuai jadwal.",
  },
  {
    code: "K05",
    name: "Sistem CVT / Transmisi",
    symptoms: ["G01", "G06", "G09"],
    solution:
      "Bongkar dan bersihkan CVT. Periksa V-belt, roller, kampas ganda, dan pulley.",
  },
];

/** Peta kode gejala → bobot, dipakai mesin CBR. */
export const WEIGHTS = Object.fromEntries(SYMPTOMS.map((s) => [s.code, s.weight]));

/** Peta kode gejala → deskripsi, dipakai tampilan rincian. */
export const LABELS = Object.fromEntries(SYMPTOMS.map((s) => [s.code, s.label]));
