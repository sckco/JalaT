// Semua manipulasi DOM untuk aplikasi diagnosa motor.

import { SYMPTOMS } from "./data.js";
import { diagnose } from "./cbr.js";

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

/** Inisialisasi seluruh UI: render gejala, hasil, toast, dan event handler. */
export function initUI() {
  const selected = new Set();
  const symptomsEl = $("symptoms");
  const countEl = $("count");
  const resultsEl = $("results");
  const resSec = $("resSec");
  const toastEl = $("toast");
  const toastMsg = $("tmsg");

  let toastTimer;
  let bumpTimer;

  // Render daftar gejala
  symptomsEl.innerHTML = SYMPTOMS.map(
    (s, i) => `
 <label class="sym" data-c="${esc(s.code)}" style="--n:${i}">
  <input type="checkbox" value="${esc(s.code)}">
  <span class="cd">${esc(s.code)}</span>
  <span class="lb">${esc(s.label)}<small>bobot ${s.weight}</small></span>
  <span class="st">OFF</span><span class="lamp"></span>${BOLT}
 </label>`,
  ).join("");

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

  function toast(message) {
    toastMsg.textContent = message;
    toastEl.classList.remove("show");
    void toastEl.offsetWidth;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
  }

  function render(results) {
    resSec.hidden = false;
    resultsEl.innerHTML = results
      .map(
        (r, i) => `
  <article class="nota" style="--i:${i}">
    <div class="nh"><span>SPK-${esc(r.caseCode)}</span><span>PERINGKAT ${i + 1}</span></div>
    ${i === 0 ? '<div class="stamp">Prioritas<br>cek</div>' : ""}
    <div class="nn">${esc(r.caseName)}</div>
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
  </article>`,
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

  $("run").addEventListener("click", () => {
    if (selected.size === 0) {
      toast("Pilih dulu minimal satu gejala, Bos.");
      symptomsEl.classList.remove("shake");
      void symptomsEl.offsetWidth;
      symptomsEl.classList.add("shake");
      return;
    }
    render(diagnose(selected));
  });

  $("reset").addEventListener("click", () => {
    selected.clear();
    symptomsEl.querySelectorAll(".sym").forEach((row) => {
      row.classList.remove("on");
      row.querySelector("input").checked = false;
      row.querySelector(".st").textContent = "OFF";
    });
    countEl.textContent = "00";
    resultsEl.innerHTML = "";
    resSec.hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
