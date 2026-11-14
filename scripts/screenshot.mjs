// Usage: node scripts/screenshot.mjs <outDir> <url> [url...]  (env WIDTH, HEIGHT, WAIT ms)
// Captures full-page PNGs plus console errors and failed requests, for visual QA.
import { chromium } from "playwright-core";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const [outDir, ...urls] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const exe = process.env.CHROMIUM ?? join(homedir(), "Library/Caches/ms-playwright/chromium-1140/chrome-mac/Chromium.app/Contents/MacOS/Chromium");
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: +(process.env.WIDTH ?? 1440), height: +(process.env.HEIGHT ?? 900) } });
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
page.on("response", (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()}: ${r.url()}`));
for (const [i, url] of urls.entries()) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(+(process.env.WAIT ?? 1500));
  const file = join(outDir, `${String(i).padStart(2, "0")}-${new URL(url).pathname.replace(/\W+/g, "_") || "home"}.png`);
  await page.screenshot({ path: file, fullPage: process.env.FULL !== "0" });
  console.log("saved", file);
}
console.log(problems.length ? problems.slice(0, 40).join("\n") : "no console errors / failed requests");
await browser.close();
