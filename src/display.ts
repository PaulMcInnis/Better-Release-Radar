import chalk from "chalk";
import Table from "cli-table3";
import type { Release } from "./interfaces.ts";


// Function to display albums in a nice formatted table with colors
export function displayAlbums(releases: Release[], showUrls: boolean) {
  // Creating a new table with headers
  const table = new Table({
    head: [
      chalk.bold("Type"),
      chalk.bold("Date"),
      chalk.bold("URL"),
      chalk.bold("Artist"),
      chalk.bold("Name"),
    ],
    colWidths: [10, 12, 50, 30, 50],
  });

  // Adding each album to the table
  releases.forEach((release) => {
    table.push([
      chalk.green(release.type), // Make album type green
      chalk.yellow(release.releaseDate), // Date in yellow
      chalk.cyan(showUrls ? release.url : release.uri), // URL in cyan
      chalk.magenta(release.artist), // Artist name in magenta
      chalk.whiteBright(release.name), // Album name in white
    ]);
  });

  // Print the table to the console
  console.log(table.toString());
}
