// Semua manipulasi DOM untuk aplikasi diagnosa motor.

import { SYMPTOMS, CASES, initialValidation, validateData } from "./data.js";
import { diagnose, findTieGroups, MIN_CONFIDENCE } from "./cbr.js";

const $ = (id) => document.getElementById(id);

const fmt = (value) => value.toFixed(2);

const BOLT =
  '<svg class="bolt" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M16 2l11 6.5v13L16 28 5 21.5v-13z"/><circle cx="16" cy="15" r="4.5"/></svg>';

/** Escape teks statis agar aman bila data diubah nanti. */
function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Warna jarum: merah di bawah 40%, kuning di bawah 70%, hijau sisanya. */
const tone = (percentage) => (percentage < 40 ? "var(--red)" : percentage < 70 ? "#e0a400" : "#1fa75a");

/** Jarum ukur untuk peringkat 1. */
function gauge(result, index) {
  const p = result.percentage;
  return `<svg class="gauge" viewBox="0 0 200 154" role="img" aria-label="Kemiripan ${p.toFixed(1)} persen" style="--gc:${tone(p)};--i:${index};--p:${p};--a:${p * 1.8 - 90}deg">
   <path class="tr" d="M20 100A80 80 0 0 1 180 100" fill="none" stroke-width="14" stroke-linecap="round" pathLength="100"/>
   <path class="fl" d="M20 100A80 80 0 0 1 180 100" fill="none" stroke-width="14" stroke-linecap="round" pathLength="100" stroke-dasharray="100"/>
   <g class="nd"><path d="M100 100L96 100L100 30L104 100Z" fill="#1d1b16"/></g>
   <circle cx="100" cy="100" r="9" fill="#1d1b16"/><circle cx="100" cy="100" r="3" fill="#ffc400"/>
   <text class="gv" x="100" y="148">${p.toFixed(1)}%</text></svg>`;
}

/** Sepuluh segmen bahan bakar untuk peringkat 2–5. */
function fuel(result, index) {
  const filled = Math.round(result.percentage / 10);
  return `<div class="fuel" style="--gc:${tone(result.percentage)};--i:${index}" role="img" aria-label="Kemiripan ${result.percentage.toFixed(1)} persen">${Array.from(
    { length: 10 },
    (_, k) => `<i class="${k < filled ? "f" : ""}" style="--s:${k}"></i>`,
  ).join("")}</div>
   <div class="pcs"><span>KEMIRIPAN</span><b>${result.percentage.toFixed(1)}%</b></div>`;
}

/** Banner keselamatan untuk 3 peringkat teratas. */
function safetyBanner(result, index) {
  if (index >= 3) return "";
  if (result.urgency === "jangan-dikendarai") {
    return `<div class="safety-banner danger" role="alert">
      <div class="sb-badge">BAHAYA</div>
      <div class="sb-body">
        <strong>Jangan dikendarai dulu.</strong>
        ${result.warning ? `<span>${esc(result.warning)}</span>` : ""}
      </div>
    </div>`;
  }
  if (result.urgency === "segera") {
    return `<div class="safety-banner warn" role="alert">
      <div class="sb-badge">PERIKSA SEGERA</div>
      <div class="sb-body">
        <strong>Periksa segera ke bengkel.</strong>
        ${result.warning ? `<span>${esc(result.warning)}</span>` : ""}
      </div>
    </div>`;
  }
  return "";
}

/** Inisialisasi seluruh UI: render gejala, hasil, toast, dan event handler. */
export function initUI() {
  const selected = new Set();
  const symptomsEl = $("symptoms");
  const countEl = $("count");
  const resultsEl = $("results");
  const resSec = $("resSec");
  const confBanner = $("confidenceBanner");
  const searchInput = $("searchInput");
  const noSymptomsEl = $("noSymptoms");
  const ecoBtn = $("ecoBtn");
  const ecoStatus = $("ecoStatus");
  const toastEl = $("toast");
  const toastMsg = $("tmsg");
  const copyBtn = $("copyBtn");
  const printBtn = $("printBtn");

  let toastTimer;
  let bumpTimer;
  let ecoMode = false;
  let lastResults = [];
  let activeCases = [...CASES];

  // Validasi data saat dimuat
  if (!initialValidation.valid) {
    console.error("Validasi basis data JalaT gagal:", initialValidation.errors);
    const errContainer = document.createElement("div");
    errContainer.className = "data-error-banner";
    errContainer.setAttribute("role", "alert");
    errContainer.innerHTML = `
      <h3>⚠️ DATA BASIS PENGETAHUAN RUSAK</h3>
      <p>Aplikasi tidak dapat dijalankan dengan aman karena kesalahan pada data/symptoms.json atau data/cases.json:</p>
      <ul>${initialValidation.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      <p>Mohon perbaiki data sebelum melanjutkan diagnosa.</p>
    `;
    symptomsEl.before(errContainer);
    if ($("run")) $("run").disabled = true;
    return;
  }

  // Mode hemat
  function setEco(enable) {
    ecoMode = enable;
    document.documentElement.classList.toggle("eco-mode", enable);
    if (ecoBtn) ecoBtn.setAttribute("aria-pressed", String(enable));
    if (ecoStatus) ecoStatus.textContent = enable ? "ON" : "OFF";
  }

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (motionQuery.matches) {
    setEco(true);
  }
  motionQuery.addEventListener("change", (e) => {
    if (e.matches) setEco(true);
  });

  if (ecoBtn) {
    ecoBtn.addEventListener("click", () => {
      setEco(!ecoMode);
    });
  }

  // Kelompokkan gejala per group
  const groupOrder = ["Mesin", "Kelistrikan", "Bunyi & getaran", "Bahan bakar & asap"];
  const grouped = new Map();
  groupOrder.forEach((g) => grouped.set(g, []));

  SYMPTOMS.forEach((s) => {
    const g = s.group || "Lainnya";
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g).push(s);
  });

  let globalIndex = 0;
  let groupsHtml = "";

  for (const [groupName, items] of grouped.entries()) {
    if (!items.length) continue;
    const itemsHtml = items
      .map((s) => {
        const idx = globalIndex++;
        return `
 <label class="sym" data-c="${esc(s.code)}" style="--n:${idx}">
  <input type="checkbox" value="${esc(s.code)}">
  <span class="cd">${esc(s.code)}</span>
  <span class="lb">${esc(s.label)}<small>bobot ${s.weight}</small></span>
  <span class="st">OFF</span><span class="lamp"></span>${BOLT}
 </label>`;
      })
      .join("");

    groupsHtml += `
 <div class="sym-group" data-group="${esc(groupName)}">
  <button type="button" class="group-hdr" aria-expanded="true">
    <span class="group-title">${esc(groupName)}</span>
    <span class="group-badge">${items.length} gejala</span>
    <span class="group-arr" aria-hidden="true">▾</span>
  </button>
  <div class="group-body open">
    <div class="group-list">${itemsHtml}</div>
  </div>
 </div>`;
  }

  symptomsEl.innerHTML = groupsHtml;

  // Event handler pelipatan grup
  symptomsEl.querySelectorAll(".group-hdr").forEach((btn) => {
    btn.addEventListener("click", () => {
      const body = btn.nextElementSibling;
      const isOpen = body.classList.toggle("open");
      body.classList.toggle("closed", !isOpen);
      btn.setAttribute("aria-expanded", String(isOpen));
      btn.querySelector(".group-arr").textContent = isOpen ? "▾" : "▸";
    });
  });

  function refreshCount() {
    countEl.textContent = String(selected.size).padStart(2, "0");
    countEl.classList.add("bump");
    clearTimeout(bumpTimer);
    bumpTimer = setTimeout(() => countEl.classList.remove("bump"), 250);
  }

  symptomsEl.querySelectorAll(".sym input").forEach((input) => {
    input.addEventListener("change", () => {
      const row = input.closest(".sym");
      if (input.checked) selected.add(input.value);
      else selected.delete(input.value);
      row.classList.toggle("on", input.checked);
      row.querySelector(".st").textContent = input.checked ? "AKTIF" : "OFF";
      refreshCount();
    });
  });

  // Pencarian gejala
  function applyFilter(query) {
    const q = (query || "").trim().toLowerCase();
    let totalVisible = 0;

    symptomsEl.querySelectorAll(".sym-group").forEach((groupEl) => {
      let groupVisible = 0;
      groupEl.querySelectorAll(".sym").forEach((symEl) => {
        const code = symEl.dataset.c;
        const s = SYMPTOMS.find((item) => item.code === code);
        let match = true;
        if (q && s) {
          const inCode = s.code.toLowerCase().includes(q);
          const inLabel = s.label.toLowerCase().includes(q);
          const inAliases = (s.aliases || []).some((a) => a.toLowerCase().includes(q));
          match = inCode || inLabel || inAliases;
        }
        symEl.hidden = !match;
        if (match) {
          groupVisible++;
          totalVisible++;
        }
      });
      groupEl.hidden = groupVisible === 0;
    });

    if (noSymptomsEl) {
      noSymptomsEl.hidden = totalVisible > 0;
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      applyFilter(e.target.value);
    });
  }

  function toast(message) {
    toastMsg.textContent = message;
    toastEl.classList.remove("show");
    void toastEl.offsetWidth;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
  }

  function render(results) {
    lastResults = results;
    resSec.hidden = false;

    // 1. Ambang kepercayaan (< 40%)
    const topScore = results.length > 0 ? results[0].percentage : 0;
    if (confBanner) {
      confBanner.hidden = topScore >= MIN_CONFIDENCE;
    }

    // 2. Deteksi skor seri
    const tieMap = findTieGroups(results, selected);

    resultsEl.innerHTML = results
      .map(
        (r, i) => {
          const tieInfo = tieMap.get(r.caseCode);
          const isTie = tieInfo?.isTie;
          const tieBadge = isTie ? `<span class="badge-seri" aria-label="Skor seri dengan kasus lain">SERI</span>` : "";
          const tieAdvice = isTie && tieInfo.distinguishing.length > 0
            ? `<div class="tie-hint"><strong>Cek juga:</strong> ${tieInfo.distinguishing.map((d) => `<b>${esc(d.code)}</b> (${esc(d.label)})`).join(", ")}</div>`
            : "";

          return `
  <article class="nota ${isTie ? "nota-tie" : ""}" style="--i:${i}">
    <div class="nh">
      <span>SPK-${esc(r.caseCode)}</span>
      <span class="rank-tag">${tieBadge}PERINGKAT ${i + 1}</span>
    </div>
    ${i === 0 ? '<div class="stamp">Prioritas<br>cek</div>' : ""}
    <div class="nn">${esc(r.caseName)}</div>
    ${safetyBanner(r, i)}
    ${tieAdvice}
    ${i === 0 ? gauge(r, i) : fuel(r, i)}
    <div class="meta">${r.matchedCount} cocok dari ${r.totalCompared} gejala · skor ${fmt(r.similarity)}</div>
    <p class="sol"><b>Saran awal:</b> ${esc(r.solution)}</p>
    <button class="tg" type="button" aria-expanded="false">Buka rincian ▾</button>
    <div class="drw"><div>
      <div class="tbw"><table><tr><th>Gejala</th><th>Bobot</th><th>Input</th><th>Kasus</th></tr>
      ${r.rows
        .map(
          (row) => `<tr><td>${esc(row.code)} ${esc(row.label)}</td><td>${row.weight}</td>
       <td class="${row.inInput ? "y" : "n"}">${row.inInput ? "YA" : "-"}</td>
       <td class="${row.inCase ? "y" : "n"}">${row.inCase ? "YA" : "-"}</td></tr>`,
        )
        .join("")}</table></div>
      <div class="fm">Similarity = ${fmt(r.numeratorWeight)} ÷ ${fmt(r.denominatorWeight)} = ${fmt(r.similarity)}</div>
    </div></div>
  </article>`;
        },
      )
      .join("");

    resultsEl.querySelectorAll(".tg").forEach((button) => {
      button.addEventListener("click", () => {
        const open = button.nextElementSibling.classList.toggle("open");
        button.setAttribute("aria-expanded", String(open));
        button.textContent = open ? "Tutup rincian ▴" : "Buka rincian ▾";
      });
    });

    setTimeout(() => resSec.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  // Salin hasil ke clipboard
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      if (!lastResults.length) return;

      const selectedList = Array.from(selected)
        .map((code) => {
          const s = SYMPTOMS.find((item) => item.code === code);
          return `• ${code} - ${s ? s.label : ""}`;
        })
        .join("\n");

      const topThree = lastResults
        .slice(0, 3)
        .map((r, i) => `${i + 1}. SPK-${r.caseCode}: ${r.caseName} (${r.percentage.toFixed(1)}%)`)
        .join("\n");

      const topSolution = lastResults[0]?.solution || "-";

      const textSummary =
`--- HASIL DIAGNOSA JALAT ---
Gejala yang dipilih:
${selectedList || "Tidak ada gejala"}

Peringkat Kerusakan Teratas:
${topThree}

Saran Awal:
${topSolution}

*JalaT hanya diagnosa awal dan tidak menggantikan pemeriksaan mekanik.*`;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(textSummary);
        } else {
          const ta = document.createElement("textarea");
          ta.value = textSummary;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        toast("Hasil diagnosa disalin ke clipboard!");
      } catch (err) {
        console.error("Gagal menyalin hasil:", err);
        toast("Gagal menyalin teks ke clipboard.");
      }
    });
  }

  // Cetak nota
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  $("run").addEventListener("click", () => {
    if (selected.size === 0) {
      toast("Pilih dulu minimal satu gejala, Bos.");
      symptomsEl.classList.remove("shake");
      void symptomsEl.offsetWidth;
      symptomsEl.classList.add("shake");
      return;
    }
    render(diagnose(selected, activeCases));
  });

  $("reset").addEventListener("click", () => {
    selected.clear();
    if (searchInput) {
      searchInput.value = "";
      applyFilter("");
    }
    symptomsEl.querySelectorAll(".sym").forEach((row) => {
      row.classList.remove("on");
      row.querySelector("input").checked = false;
      row.querySelector(".st").textContent = "OFF";
    });
    countEl.textContent = "00";
    resultsEl.innerHTML = "";
    if (confBanner) confBanner.hidden = true;
    resSec.hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ==========================================
  // FASE 6: Mode Mekanik (Retain Kasus CBR)
  // ==========================================
  const mechToggle = $("mechToggle");
  const mechClose = $("mechClose");
  const mechPanel = $("mechPanel");
  const mechForm = $("mechForm");
  const mechError = $("mechError");
  const mechSymptomsList = $("mechSymptomsList");
  const newCaseCode = $("newCaseCode");
  const exportCasesBtn = $("exportCasesBtn");

  function getNextCaseCode() {
    let maxNum = 0;
    for (const c of activeCases) {
      const match = c.code.match(/K(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `K${String(maxNum + 1).padStart(2, "0")}`;
  }

  function initMechPanel() {
    if (!mechSymptomsList) return;

    if (newCaseCode) {
      newCaseCode.value = getNextCaseCode();
    }

    mechSymptomsList.innerHTML = SYMPTOMS.map(
      (s) => `
      <div class="mech-sym-item">
        <label class="mech-sym-lbl">
          <input type="checkbox" value="${esc(s.code)}" class="mech-sym-chk">
          <span><b>${esc(s.code)}</b> ${esc(s.label)}</span>
        </label>
        <div class="mech-weight-wrap">
          <label for="mw_${esc(s.code)}">Bobot:</label>
          <input type="number" id="mw_${esc(s.code)}" min="0" max="1" step="0.1" value="${s.weight}" class="mech-sym-w" disabled aria-label="Bobot pasangan untuk ${esc(s.code)}">
        </div>
      </div>
    `,
    ).join("");

    mechSymptomsList.querySelectorAll(".mech-sym-chk").forEach((chk) => {
      chk.addEventListener("change", () => {
        const item = chk.closest(".mech-sym-item");
        const wInput = item.querySelector(".mech-sym-w");
        wInput.disabled = !chk.checked;
        item.classList.toggle("selected", chk.checked);
      });
    });
  }

  initMechPanel();

  if (mechToggle && mechPanel) {
    mechToggle.addEventListener("click", () => {
      const isHidden = mechPanel.hidden;
      mechPanel.hidden = !isHidden;
      mechToggle.setAttribute("aria-expanded", String(isHidden));
      if (isHidden) {
        if (newCaseCode) newCaseCode.value = getNextCaseCode();
        mechPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (mechClose && mechPanel) {
    mechClose.addEventListener("click", () => {
      mechPanel.hidden = true;
      if (mechToggle) mechToggle.setAttribute("aria-expanded", "false");
    });
  }

  if (mechForm) {
    mechForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (mechError) mechError.hidden = true;

      const code = ($("newCaseCode")?.value || "").trim().toUpperCase();
      const name = ($("newCaseName")?.value || "").trim();
      const urgency = $("newCaseUrgency")?.value || "segera";
      const warning = ($("newCaseWarning")?.value || "").trim();
      const solution = ($("newCaseSolution")?.value || "").trim();

      const caseSymptoms = [];
      mechSymptomsList.querySelectorAll(".mech-sym-item").forEach((item) => {
        const chk = item.querySelector(".mech-sym-chk");
        const wInput = item.querySelector(".mech-sym-w");
        if (chk && chk.checked) {
          const weightVal = parseFloat(wInput.value);
          caseSymptoms.push({
            code: chk.value,
            weight: Number.isFinite(weightVal) ? weightVal : undefined,
          });
        }
      });

      if (caseSymptoms.length === 0) {
        if (mechError) {
          mechError.hidden = false;
          mechError.innerHTML = "Pilih minimal satu gejala untuk kasus ini.";
        }
        return;
      }

      const newCase = {
        code,
        name,
        urgency,
        warning: warning || undefined,
        symptoms: caseSymptoms,
        solution,
      };

      // Validasi kasus baru menggunakan aturan yang sama seperti Fase 3
      const check = validateData(SYMPTOMS, [...activeCases, newCase]);
      if (!check.valid) {
        if (mechError) {
          mechError.hidden = false;
          mechError.innerHTML = `<strong>Gagal menyimpan kasus:</strong><ul>${check.errors.map((err) => `<li>${esc(err)}</li>`).join("")}</ul>`;
        }
        return;
      }

      activeCases.push(newCase);
      toast(`Kasus baru ${code} berhasil diretain ke memori sesi!`);

      // Reset form
      mechForm.reset();
      initMechPanel();
      if (newCaseCode) newCaseCode.value = getNextCaseCode();

      // Jika sedang ada hasil diagnosa, hitung ulang secara langsung
      if (!resSec.hidden && selected.size > 0) {
        render(diagnose(selected, activeCases));
      }
    });
  }

  // Ekspor basis kasus
  if (exportCasesBtn) {
    exportCasesBtn.addEventListener("click", () => {
      try {
        const jsonContent = JSON.stringify(activeCases, null, 2);
        const blob = new Blob([jsonContent], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "cases.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast("File cases.json berhasil diunduh!");
      } catch (err) {
        console.error("Gagal mengekspor cases.json:", err);
        toast("Gagal mengekspor file cases.json.");
      }
    });
  }
}
