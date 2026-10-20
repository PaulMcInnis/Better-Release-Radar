// Writes the JSON report and the HTML page built from it.
// Kept free of the CLI and logger so build-html.ts can use it on its own.
import { execFileSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Report } from "./interfaces";

const templateFile = path.join(__dirname, "html", "template.html");

export function writeJson(report: Report, filePath: string) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
}

// The report is embedded in the page, so it opens straight from disk with no server
export function renderHtml(report: Report): string {
  const template = fs.readFileSync(templateFile, "utf8");
  // Escape "<" so album names can't close the <script> tag the data lives in
  const json = JSON.stringify(report).replace(/</g, "\\u003c");
  return template.replace("__REPORT_JSON__", () => json);
}

export function writeHtml(report: Report, filePath: string) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, renderHtml(report));
}

function isWsl(): boolean {
  try {
    return /microsoft/i.test(fs.readFileSync("/proc/version", "utf8"));
  } catch {
    return false;
  }
}

// Open a local file in the default browser, including the Windows browser from WSL
export function openInBrowser(filePath: string) {
  const absolutePath = path.resolve(filePath);
  let command: string;
  let args: string[];
  if (process.platform === "darwin") {
    [command, args] = ["open", [absolutePath]];
  } else if (process.platform === "win32") {
    [command, args] = ["cmd", ["/c", "start", "", absolutePath]];
  } else if (isWsl()) {
    const windowsPath = execFileSync("wslpath", ["-w", absolutePath])
      .toString()
      .trim();
    [command, args] = ["explorer.exe", [windowsPath]];
  } else {
    [command, args] = ["xdg-open", [absolutePath]];
  }
  spawn(command, args, { detached: true, stdio: "ignore" })
    .on("error", () => {
      console.error(`Couldn't open a browser; open ${absolutePath} yourself.`);
    })
    .unref();
}
