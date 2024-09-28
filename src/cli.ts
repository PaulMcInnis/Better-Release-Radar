import { Command } from "commander";

export const program = new Command();
program
  .option(
    "--max-age-days <number>",
    "Maximum age of albums to display in days",
    "60"
  )
  .option("--hide-eps", "Hide EPs, only show full-length releases", false)
  .option("--show-urls", "Show full URLs instead of Spotify URIs", false)
  .option("--log-file <path>", "Path to log file", "log.log")
  .option("--log-level <level>", "Logging level", "info")
  .option("--region <region>", "Region for album releases", "CA")
  .option("--show-re-releases", "Show re-releases", false)
  .option("--show-live-recordings", "Show live recordings", false)
  .option("--show-soundtracks", "Show soundtracks", false)
  .option("--show-remixes", "Show remixes", false)
  .option("--log-filtered", "Log filtered albums", false)
  .parse(process.argv);

export const options = program.opts();
