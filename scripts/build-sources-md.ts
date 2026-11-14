/** Regenerate SOURCES.md from the product's registries. Usage: npm run sources:doc */
import { readFileSync, writeFileSync } from "node:fs";
import { buildSourcesMd } from "./sources-md-input";
writeFileSync("SOURCES.md", buildSourcesMd(readFileSync));
console.log("SOURCES.md updated");
