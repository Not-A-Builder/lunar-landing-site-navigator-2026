// Visual QA of a site page in all three personas. Usage: node scripts/qa-site.mjs <outDir> <path>
import { chromium } from "playwright-core";
import { homedir } from "node:os";
const [out, path] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: homedir() + "/Library/Caches/ms-playwright/chromium-1140/chrome-mac/Chromium.app/Contents/MacOS/Chromium" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
p.on("pageerror", (e) => errs.push(e.message));
p.on("response", (r) => r.status() >= 400 && errs.push(`HTTP ${r.status()} ${r.url()}`));
const t0 = Date.now();
await p.goto("http://localhost:1313" + path, { waitUntil: "networkidle" });
await p.waitForFunction(() => document.body.innerText.includes("All results computed"), null, { timeout: 90000 }).catch(() => errs.push("full analysis did not finish in 90 s"));
console.log("full analysis after", ((Date.now() - t0) / 1000).toFixed(1), "s");
for (const persona of ["Enthusiast", "Educator", "Mission planner"]) {
  await p.getByRole("radio", { name: persona }).click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/site-${persona.split(" ")[0].toLowerCase()}.png`, fullPage: true });
}
const txt = await p.evaluate(() => document.body.innerText);
console.log("metrics line:", txt.match(/\d+ of 196 metrics have values/)?.[0]);
console.log(errs.slice(0, 15).join("\n") || "no errors");
await b.close();
