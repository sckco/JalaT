import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 320, height: 700 }, colorScheme: "dark" });
const p = await ctx.newPage();
await p.goto("http://localhost:5180/", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
console.log(await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > innerWidth + 0.5 || r.left < -0.5)) {
      out.push(`${el.tagName.toLowerCase()}.${el.className}: left=${r.left.toFixed(1)} right=${r.right.toFixed(1)}`);
    }
  }
  window.scrollTo(500, 0);
  return { scrollWidth: document.documentElement.scrollWidth, innerWidth, scrollX: window.scrollX, bodyScrollWidth: document.body.scrollWidth, offenders: out.slice(0, 12) };
}));
await browser.close();
