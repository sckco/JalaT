import { chromium } from "playwright";
const BASE = "http://localhost:5180/";
const SHOT = "shots/";
const fails = [];
const errors = [];
const ok = (name, cond, info = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? "  — " + info : ""}`); if (!cond) fails.push(name); };

const browser = await chromium.launch();

// ---------- desktop light ----------
const ctxD = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
const d = await ctxD.newPage();
d.on("console", (m) => m.type() === "error" && errors.push(m.text()));
d.on("pageerror", (e) => errors.push(String(e)));
const resp = await d.goto(BASE, { waitUntil: "networkidle" });
ok("Halaman termuat", resp?.status() === 200, String(resp?.status()));
ok("Judul JalaT", (await d.title()).includes("JalaT"), await d.title());
await d.waitForTimeout(2200);
await d.screenshot({ path: SHOT + "d1-empty.png" });
ok("10 baris gejala", (await d.locator(".sym").count()) === 10);
ok("Penghitung awal 00", (await d.textContent("#count")) === "00");

// kriteria 2: validasi
await d.click("#run");
await d.waitForTimeout(600);
ok("Toast validasi tampil", (await d.textContent("#tmsg")).includes("minimal satu gejala"));
ok("Seksi hasil tetap tersembunyi", await d.locator("#resSec").isHidden());
await d.screenshot({ path: SHOT + "d2-toast.png", clip: { x: 0, y: 0, width: 1440, height: 220 } });

// kriteria 3: cocok penuh
for (const c of ["G01", "G06", "G09"]) await d.click(`.sym[data-c="${c}"]`);
ok("Penghitung 03", (await d.textContent("#count")) === "03", await d.textContent("#count"));
ok("Label status AKTIF", (await d.locator(".sym.on .st").first().textContent()) === "AKTIF");
await d.click("#run");
await d.waitForTimeout(2600);
const first = d.locator(".nota").first();
ok("Peringkat 1 = K05", (await first.textContent()).includes("Sistem CVT"), "");
ok("Peringkat 1 = 100.0%", (await first.textContent()).includes("100.0%"));
ok("Stempel prioritas ada", (await d.locator(".nota").first().locator(".stamp").count()) === 1);
ok("Gauge SVG ada", (await d.locator(".gauge").count()) === 1);
await d.screenshot({ path: SHOT + "d3-results.png" });

// rincian
await first.locator(".tg").click();
await d.waitForTimeout(700);
ok("Rincian terbuka", await first.locator(".drw").evaluate((el) => el.classList.contains("open")));
ok("Tabel rincian 3 gejala", (await first.locator(".drw tr").count()) === 4, String(await first.locator(".drw tr").count()));
ok("Rumus tampil", (await first.locator(".fm").textContent()).includes("2.20 ÷ 2.20 = 1.00"), await first.locator(".fm").textContent());
await d.screenshot({ path: SHOT + "d4-detail.png", fullPage: false });

// kriteria 4: urutan
await d.click("#reset");
await d.waitForTimeout(400);
for (const c of ["G01", "G02"]) await d.click(`.sym[data-c="${c}"]`);
await d.click("#run");
await d.waitForTimeout(2600);
const pcts = await d.locator(".nota").evaluateAll((els) =>
  els.map((e) => parseFloat(e.textContent.match(/(\d+\.\d)%/)[1])));
ok("5 nota tampil", pcts.length === 5, JSON.stringify(pcts));
ok("Urutan menurun", pcts.every((p, i) => i === 0 || pcts[i - 1] >= p), JSON.stringify(pcts));
const bodyTxt = await d.locator("#results").textContent();
ok("Tidak ada NaN/undefined", !/NaN|undefined|Infinity/.test(bodyTxt));
ok("Tidak ada overflow horizontal", await d.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

// kriteria 5: reset
await d.click("#reset");
await d.waitForTimeout(500);
ok("Reset: 0 centang", (await d.locator(".sym input:checked").count()) === 0);
ok("Reset: 0 baris on", (await d.locator(".sym.on").count()) === 0);
ok("Reset: penghitung 00", (await d.textContent("#count")) === "00");
ok("Reset: hasil kosong", (await d.textContent("#results")) === "");
ok("Reset: seksi tersembunyi", await d.locator("#resSec").isHidden());

// cookie & localstorage kosong (tanpa persistensi)
ok("Tanpa localStorage/sessionStorage", await d.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0));
await ctxD.close();

// ---------- mobile light ----------
const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light" });
const m = await ctxM.newPage();
m.on("pageerror", (e) => errors.push(String(e)));
await m.goto(BASE, { waitUntil: "networkidle" });
await m.waitForTimeout(2400);
await m.screenshot({ path: SHOT + "m1-empty.png" });
for (const c of ["G01", "G06", "G09"]) await m.click(`.sym[data-c="${c}"]`);
await m.click("#run");
await m.waitForTimeout(2600);
await m.screenshot({ path: SHOT + "m2-results.png" });
await m.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await m.waitForTimeout(900);
await m.screenshot({ path: SHOT + "m3-bottom.png" });
ok("Mobile: tanpa overflow horizontal", await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  await m.evaluate(() => `${document.documentElement.scrollWidth} vs ${innerWidth}`));
const dockBox = await m.locator(".dock").boundingBox();
const lastCard = await m.locator(".nota").last().boundingBox();
ok("Dock tidak menutupi kartu terakhir", lastCard && dockBox.y > lastCard.y + lastCard.height - 4,
  JSON.stringify({ dockTop: Math.round(dockBox.y), cardBottom: Math.round(lastCard.y + lastCard.height) }));
await m.locator(".nota").first().locator(".tg").click();
await m.waitForTimeout(600);
await m.locator(".nota").first().locator(".drw").scrollIntoViewIfNeeded();
await m.waitForTimeout(500);
await m.screenshot({ path: SHOT + "m4-detail.png" });
await ctxM.close();

// ---------- mobile dark ----------
const ctxK = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "dark" });
const k = await ctxK.newPage();
k.on("pageerror", (e) => errors.push(String(e)));
await k.goto(BASE, { waitUntil: "networkidle" });
await k.waitForTimeout(2400);
await k.click("#run");
await k.waitForTimeout(700);
await k.screenshot({ path: SHOT + "k1-empty-toast.png" });
for (const c of ["G02", "G05", "G07"]) await k.click(`.sym[data-c="${c}"]`);
await k.click("#run");
await k.waitForTimeout(2600);
await k.screenshot({ path: SHOT + "k2-results.png" });
await ctxK.close();

// ---------- 320 px ----------
const ctxS = await browser.newContext({ viewport: { width: 320, height: 700 }, colorScheme: "dark" });
const s = await ctxS.newPage();
await s.goto(BASE, { waitUntil: "networkidle" });
await s.waitForTimeout(2200);
await s.screenshot({ path: SHOT + "s1-empty.png" });
for (const c of ["G01", "G02"]) await s.click(`.sym[data-c="${c}"]`);
await s.click("#run");
await s.waitForTimeout(2400);
await s.screenshot({ path: SHOT + "s2-results.png" });
ok("320px: tanpa overflow", await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  await s.evaluate(() => `${document.documentElement.scrollWidth} vs ${innerWidth}`));
const clipped = await s.evaluate(() => [...document.querySelectorAll(".nota,.sym,.odo,h1,.tag")].filter((el) => {
  const r = el.getBoundingClientRect();
  return r.right > innerWidth + 1 || r.left < -1;
}).map((el) => el.className + ":" + Math.round(el.getBoundingClientRect().right)));
ok("320px: tidak ada elemen terpotong", clipped.length === 0, JSON.stringify(clipped));
await ctxS.close();

// ---------- reduced motion ----------
const ctxR = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: "dark" });
const r = await ctxR.newPage();
await r.goto(BASE, { waitUntil: "networkidle" });
await r.waitForTimeout(400);
const op = await r.locator(".sym").evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity));
ok("Reduced motion: semua baris terlihat", op.every((o) => o === "1"), JSON.stringify(op));
await r.screenshot({ path: SHOT + "r1-reduced.png" });
await ctxR.close();

await browser.close();
console.log(`\n=== Ringkasan ===\n${(fails.length ? "GAGAL: " + fails.join(", ") : "Semua pemeriksaan lulus")}\nconsole errors: ${errors.length}${errors.length ? " → " + errors.join(" | ") : ""}`);
