// Visual QA: screenshots of arbitrary pages after their analyses finish. Usage: node scripts/qa-pages.mjs <outDir> <name>=<path> ...
import { chromium } from "playwright-core";
import { homedir } from "node:os";
const [out, ...pairs] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: homedir() + "/Library/Caches/ms-playwright/chromium-1140/chrome-mac/Chromium.app/Contents/MacOS/Chromium" });
const p = await b.newPage({ viewport: { width: +(process.env.WIDTH ?? 1440), height: 1000 } });
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
p.on("pageerror", (e) => errs.push(e.message.slice(0, 300)));
p.on("response", (r) => r.status() >= 400 && errs.push(`HTTP ${r.status()} ${r.url()}`));
for (const pair of pairs) {
  const [name, path] = pair.split(/=(.*)/s);
  await p.goto("http://localhost:1313" + path, { waitUntil: "networkidle" });
  await p.waitForFunction(() => !document.body.innerText.includes("Computing…") && !document.body.innerText.includes("Computing multi-year"), null, { timeout: 120000 }).catch(() => errs.push(`${name}: still computing after 120 s`));
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: process.env.FULL !== "0" });
  console.log("saved", name);
}
console.log(errs.slice(0, 15).join("\n") || "no errors");
await b.close();
