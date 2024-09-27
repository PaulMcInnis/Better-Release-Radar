import * as fs from "fs";
import * as path from "path";
import * as fuzz from "fuzzball";
import * as http from "http";
import { fileURLToPath } from "url";
import { Command } from "commander";
import SpotifyWebApi from "spotify-web-api-node";
import winston from "winston";
import chalk from "chalk";
import Table from "cli-table3";
import cliProgress from "cli-progress";

// TypeScript Interfaces for data structures
interface Artist {
  id: string;
  name: string;
}

interface Album {
  name: string;
  release_date: string;
  url: string;
  artist: string;
  type: "album" | "single" | "compilation";
}

interface RawAlbum {
  name: string;
  release_date: string;
  uri: string;
  id: string;
  album_type: "album" | "single" | "compilation";
  available_markets?: string[];
  artists: string[]; // Array of artist names associated with the album
}

// CLI Argument Parsing
const program = new Command();
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
  .parse(process.argv);

const options = program.opts();

// Logging Setup with Winston
const logger = winston.createLogger({
  level: options.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: options.logFile }),
  ],
});

// Constants for the script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheDir = path.join(__dirname, ".cache");
const tokenCacheFile = path.join(cacheDir, "spotify_tokens.json");
const today = new Date();
const todayCacheFile = path.join(
  cacheDir,
  `followed_artists_${today.toISOString().split("T")[0]}.json`
);
const SPOTIFY_ALBUM_URL_BASE = "https://open.spotify.com/album/";

// Set up Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIPY_CLIENT_ID || "",
  clientSecret: process.env.SPOTIPY_CLIENT_SECRET || "",
  redirectUri: "http://localhost:8888/callback",
});

// Step 1: Generate an Authorization URL
function getAuthorizationURL() {
  const authorizeURL = spotifyApi.createAuthorizeURL(
    ["user-follow-read"],
    "random-state"
  );
  console.log(`Authorize your app by visiting this URL: ${authorizeURL}`);
}

// Step 2: Save Tokens to Cache
function saveTokensToCache(accessToken: string, refreshToken: string) {
  const tokens = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + 3600 * 1000, // Set expiry for 1 hour (you can always refresh)
  };
  fs.writeFileSync(tokenCacheFile, JSON.stringify(tokens));
}

// Step 3: Load Tokens from Cache
function loadTokensFromCache(): {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null {
  if (fs.existsSync(tokenCacheFile)) {
    const tokens = JSON.parse(fs.readFileSync(tokenCacheFile, "utf8"));
    return tokens;
  }
  return null;
}

// Step 4: Exchange Authorization Code for Access Token and Refresh Token
async function exchangeAuthorizationCode(code: string) {
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);
    saveTokensToCache(access_token, refresh_token);
    console.log("Access token and refresh token set.");
  } catch (err) {
    console.error("Error exchanging authorization code:", err);
  }
}

// Step 5: Use refresh token to get a new access token (if needed)
async function refreshAccessToken() {
  console.log("Refreshing access token...");
  try {
    const tokens = loadTokensFromCache(); // Load tokens before trying to refresh
    if (!tokens || !tokens.refreshToken) {
      throw new Error("Refresh token is missing from cache"); // Handle missing refresh token case
    }

    // Set the refresh token in the spotifyApi instance
    spotifyApi.setRefreshToken(tokens.refreshToken);

    // Attempt to refresh the access token using the refresh token
    const data = await spotifyApi.refreshAccessToken();
    const accessToken = data.body["access_token"];

    // Update the spotifyApi instance with the new access token
    spotifyApi.setAccessToken(accessToken);

    // Save the new access token, but keep the same refresh token in the cache
    saveTokensToCache(accessToken, tokens.refreshToken);

    console.log("Access token has been refreshed.");
  } catch (err) {
    console.error("Error refreshing access token", err);
  }
}

// Step 6: Authenticate Spotify (Use cached tokens or refresh if needed)
async function authenticateSpotify() {
  const tokens = loadTokensFromCache();

  if (tokens && tokens.expiresAt > Date.now()) {
    spotifyApi.setAccessToken(tokens.accessToken);
    spotifyApi.setRefreshToken(tokens.refreshToken);
    console.log("Using cached Spotify tokens.");
  } else if (tokens && tokens.refreshToken) {
    await refreshAccessToken(); // Use refresh token if access token expired
  } else {
    getAuthorizationURL(); // No tokens, need to authorize
    startLocalServer();
  }
}

// Step 7: Set up a local server to capture the authorization code from Spotify
function startLocalServer() {
  const server = http.createServer(async (req, res) => {
    if (req.url && req.url.startsWith("/callback")) {
      const url = new URL(req.url, `http://localhost:8888`);
      const code = url.searchParams.get("code");

      if (code) {
        console.log("Authorization code received:", code);
        await exchangeAuthorizationCode(code);

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Authorization successful! You can close this window.");
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("No authorization code found.");
      }

      server.close(); // Close the server after handling the callback
      await main(); // Proceed with fetching data once authenticated
    }
  });

  server.listen(8888, () => {
    console.log(
      "Listening for Spotify authorization code on http://localhost:8888/callback"
    );
  });
}

// Ensure that the cache directory exists
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir);
}

// Utility Functions
const daysBetween = (date1: Date, date2: Date) =>
  Math.abs((+date1 - +date2) / (1000 * 60 * 60 * 24));

function deleteOldCacheFiles(directory: string, maxAgeDays: number = 30) {
  const now = Date.now();
  fs.readdirSync(directory).forEach((file) => {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    const fileAgeDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    if (fileAgeDays > maxAgeDays) {
      fs.unlinkSync(filePath);
      logger.info(`Deleted old cache file: ${file}`);
    }
  });
}

// Function to fetch followed artists with a progress bar
async function fetchFollowedArtists(): Promise<Artist[]> {
  let artists: Artist[] = [];
  let after: string | undefined = undefined; // Start with undefined
  const limit = 50; // Limit for each batch

  try {
    // First, get the total number of artists to set up the progress bar
    const initialResponse = await spotifyApi.getFollowedArtists({ limit: 1 });
    const totalArtists = initialResponse.body.artists.total || 0;
    logger.info(`Total followed artists: ${totalArtists}`);
    let response;
    do {
      // Fetch followed artists with the correct 'after' parameter
      response = await spotifyApi.getFollowedArtists({ limit, after });

      // Check if response is valid
      if (
        !response.body ||
        !response.body.artists ||
        !response.body.artists.items
      ) {
        throw new Error("Invalid response from Spotify API");
      }

      // Append fetched artists
      artists = artists.concat(
        response.body.artists.items.map((artist) => ({
          id: artist.id,
          name: artist.name,
        }))
      );

      // Set the 'after' cursor for the next request
      after = response.body.artists.cursors.after;
    } while (after); // Continue until no more pages

    return artists;
  } catch (err) {
    logger.error("Error fetching followed artists:", err);
    throw err;
  }
}

async function fetchArtistAlbums(artistId: string): Promise<RawAlbum[]> {
  let albums: RawAlbum[] = [];
  let offset = 0;
  const limit = 50; // Spotify API allows a maximum of 50 items per request

  try {
    let response;
    do {
      // Fetch albums in batches using the offset for pagination
      response = await spotifyApi.getArtistAlbums(artistId, { limit, offset });
      const fetchedAlbums = response.body.items
        .filter((album) => album.artists[0].id === artistId) // Ensure the followed artist is the primary artist
        .map((album) => ({
          name: album.name,
          release_date: album.release_date,
          uri: album.uri,
          id: album.id,
          album_type: album.album_type,
          available_markets: album.available_markets,
          artists: album.artists.map((artist) => artist.name), // Extract artist names
        }));

      albums = albums.concat(fetchedAlbums); // Append the newly fetched albums to the result
      offset += limit; // Move the offset for the next batch
    } while (response.body.items.length === limit); // Continue while we still get a full batch of results

    return albums;
  } catch (err) {
    logger.error(`Error fetching albums for artist ${artistId}`, err);
    throw err;
  }
}

/// Function to calculate fuzzy similarity between two album names
function isSimilarAlbum(
  albumName: string,
  seenNames: string[],
  threshold = 80
): boolean {
  for (const name of seenNames) {
    const similarity = fuzz.ratio(albumName, name);
    if (similarity >= threshold) {
      return true;
    }
  }
  return false;
}

// Function to display albums in a nice formatted table with colors
function displayAlbums(albums) {
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

// Function to fetch albums for artists with overall progress
async function main() {
  logger.info("Starting Better Release Radar...");

  await authenticateSpotify(); // Ensure authentication is handled

  deleteOldCacheFiles(cacheDir, 60);

  let artists: Artist[];
  if (fs.existsSync(todayCacheFile)) {
    artists = JSON.parse(fs.readFileSync(todayCacheFile, "utf8"));
    logger.info(`Loaded artists from cache: ${todayCacheFile}`);
  } else {
    artists = await fetchFollowedArtists();
    fs.writeFileSync(todayCacheFile, JSON.stringify(artists));
    logger.info("Fetched and cached followed artists");
  }

  const totalSteps = artists.length * 5; // Estimate 5 albums per artist for progress tracking

  // Initialize overall progress bar
  const overallProgressBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  overallProgressBar.start(totalSteps, 0); // Total steps: estimated albums

  const albums: Album[] = [];
  const seenAlbumNames: string[] = [];
  const todayDate = new Date();

  logger.info("Fetching artists' albums");

  for (const artist of artists) {
    const artistAlbums = await fetchArtistAlbums(artist.id);

    for (const album of artistAlbums) {
      const albumDate = new Date(album.release_date);

      if (
        daysBetween(todayDate, albumDate) <= parseInt(options.maxAgeDays, 10) &&
        (!options.region ||
          (album.available_markets &&
            album.available_markets.includes(options.region))) &&
        (!options.hideEps || album.album_type === "album") &&
        !isSimilarAlbum(album.name, seenAlbumNames)
      ) {
        seenAlbumNames.push(album.name); // Add album name to seen list

        // Use the first artist as the primary artist (you can adjust this logic if needed)
        const primaryArtist = album.artists[0];

        albums.push({
          name: album.name,
          release_date: album.release_date,
          url: options.showUrls
            ? `${SPOTIFY_ALBUM_URL_BASE}${album.id}`
            : album.uri,
          artist: primaryArtist, // Set the correct primary artist
          type: album.album_type as "album" | "single" | "compilation", // Cast to known types
        });

        // Update the overall progress bar for each album fetched
        overallProgressBar.increment();
      }
    }
  }

  // Stop the progress bar when complete
  overallProgressBar.stop();

  // Sort albums by release date
  albums.sort(
    (a, b) =>
      new Date(b.release_date).getTime() - new Date(a.release_date).getTime()
  );

  // Output the albums in a nice table format
  displayAlbums(albums);
}

main().catch((err) => {
  logger.error("Error running the script:", err);
});
