// QA of educator copy, band editing and custom coordinates. Usage: node scripts/qa-features.mjs <outDir>
import { chromium } from "playwright-core";
import { homedir } from "node:os";
const out = process.argv[2];
const b = await chromium.launch({ executablePath: homedir() + "/Library/Caches/ms-playwright/chromium-1140/chrome-mac/Chromium.app/Contents/MacOS/Chromium" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
const done = () => p.waitForFunction(() => document.body.innerText.includes("All results computed"), null, { timeout: 120000 });

// 1. Educator copy on a site page
await p.goto("http://localhost:1313/site/mons-mouton?t=2027-01-10T00:00:00.000Z", { waitUntil: "networkidle" });
await done();
await p.getByRole("radio", { name: "Educator" }).click();
await p.waitForTimeout(500);
const metrics = p.locator("h2", { hasText: "Metrics" });
await metrics.scrollIntoViewIfNeeded();
await p.evaluate(() => window.scrollBy(0, 1200));
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/educator-metrics.png` });
const eduText = await p.evaluate(() => document.body.innerText);
console.log("educator sun-elevation sentence:", eduText.match(/centre of the Sun sits [^.]+\./)?.[0]);

// 2. Planner band editing changes a rating
await p.getByRole("radio", { name: "Mission planner" }).click();
await p.waitForTimeout(500);
const before = await p.evaluate(() => document.body.innerText.match(/Sunlit, whole mission\s+(\d+%)/)?.[1]);
const amber = p.getByLabel("Sunlit share of the mission: amber threshold");
await amber.scrollIntoViewIfNeeded();
await p.screenshot({ path: `${out}/bands-panel.png` });
await amber.fill("10");
await p.getByLabel("Sunlit share of the mission: green threshold").fill("20");
await p.waitForTimeout(1500);
const badge = await p.evaluate(() => { const el = [...document.querySelectorAll("div")].find((d) => d.textContent?.startsWith("Sunlit, whole mission")); return el?.textContent; });
console.log("sunlit tile after band edit:", before, "->", badge?.slice(0, 80));
await p.getByRole("button", { name: "Reset all to defaults" }).click();

// 3. Custom coordinates typed on the home page
await p.goto("http://localhost:1313/", { waitUntil: "networkidle" });
await p.getByPlaceholder("e.g. 85.2S 30.1E").fill("85.3S 35.0W");
await p.getByRole("button", { name: "Analyse", exact: true }).click();
await p.waitForURL(/site\/custom/);
await done();
await p.screenshot({ path: `${out}/custom-site.png` });
console.log("custom url:", p.url().replace("http://localhost:1313", ""));
console.log("custom header:", (await p.locator("h1").textContent()), "|", await p.evaluate(() => document.body.innerText.match(/Nearest named feature[^\n]+/)?.[0]));

// 4. Map click drops a custom point with an Analyse card
await p.goto("http://localhost:1313/", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
const map = p.locator('[aria-label="Map of the lunar south pole"]');
const box = await map.boundingBox();
await p.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.7);
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/map-click.png` });
console.log("map click card:", await p.evaluate(() => document.body.innerText.match(/Custom point [^\n]+/)?.[0]));

// 5. Compare: custom slot
await p.goto("http://localhost:1313/compare?s=haworth@2027-01-10T00:00:00.000Z", { waitUntil: "networkidle" });
await p.getByLabel("Site for scenario B").selectOption("__custom");
await p.locator("form input").first().fill("-85.3, -35");
await p.getByRole("button", { name: "Use" }).click();
await p.waitForTimeout(500);
await p.waitForFunction(() => !document.body.innerText.includes("Computing…"), null, { timeout: 120000 });
await p.screenshot({ path: `${out}/compare-custom.png` });
console.log("compare url:", decodeURIComponent(p.url().replace("http://localhost:1313", "")));
console.log(errs.slice(0, 10).join("\n") || "no errors");
await b.close();
