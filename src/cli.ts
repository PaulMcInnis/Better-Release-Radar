import { Command } from "commander";

export const program = new Command();
program
  .option(
    "--max-age-days <number>",
    "Maximum age of albums to display in days",
    "60"
  )
  .option("--show-urls", "Show full URLs instead of Spotify URIs", false)
  .option("--log-file <path>", "Path to log file", "log.log")
  .option("--log-level <level>", "Logging level", "info")
  .option("--region <region>", "Region for album releases", "CA")
  .option(
    "--hide-eps",
    "Hide EPs, and Singles, and only show full-length releases",
    false
  )
  .option("--hide-re-releases", "Hide re-releases", false)
  .option("--hide-live-recordings", "Hide live recordings", false)
  .option("--hide-soundtracks", "Hide soundtracks", false)
  .option("--hide-remixes", "Hide remixes", false)
  .option("--log-filtered", "Log filtered albums", false)
  .parse(process.argv);

export const options = program.opts();
