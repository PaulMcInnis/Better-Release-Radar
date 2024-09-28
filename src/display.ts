import Table from "cli-table3";
const chalk = require("chalk"); // Import chalk with CommonJS

// Function to display albums in a nice formatted table with colors
export function displayAlbums(albums) {
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
  albums.forEach((album) => {
    table.push([
      chalk.green(album.type), // Make album type green
      chalk.yellow(album.release_date), // Date in yellow
      chalk.cyan(album.url), // URL in cyan
      chalk.magenta(album.artist), // Artist name in magenta
      chalk.whiteBright(album.name), // Album name in white
    ]);
  });

  // Print the table to the console
  console.log(table.toString());
}
