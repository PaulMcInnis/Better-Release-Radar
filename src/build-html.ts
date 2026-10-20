// Rebuild the HTML page from a JSON file written by --json, without fetching from Spotify again.
// Usage: npm run html -- <releases.json> [releases.html] [--open]
import * as fs from "fs";
import { Report } from "./interfaces";
import { openInBrowser, writeHtml } from "./output";

const args = process.argv.slice(2);
const open = args.includes("--open");
const [input, output] = args.filter((arg) => arg !== "--open");

if (!input) {
  console.error("Usage: npm run html -- <releases.json> [releases.html] [--open]");
  process.exit(1);
}

const report: Report = JSON.parse(fs.readFileSync(input, "utf8"));
const outputFile = output ?? input.replace(/\.json$/i, "") + ".html";
writeHtml(report, outputFile);
console.log(`Wrote ${report.releases.length} releases to ${outputFile}`);
if (open) {
  openInBrowser(outputFile);
}
