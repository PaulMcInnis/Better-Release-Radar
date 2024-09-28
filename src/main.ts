import cliProgress from "cli-progress";
import * as fs from "fs";
import SpotifyWebApi from "spotify-web-api-node";
import { authenticateSpotify } from "./auth";
import {
  albumCacheFile,
  artistCacheFile,
  cacheDir,
  deleteOldCacheFiles,
} from "./cache";
import { options } from "./cli";
import { displayAlbums } from "./display";
import { fetchArtistAlbumsWithRetry, fetchFollowedArtists } from "./fetch";
import { albumExists, isLiveRecording, isReRelease } from "./filters";
import { Album, Artist } from "./interfaces";
import { logger } from "./logger";

// Set up Spotify API
const SPOTIFY_ALBUM_URL_BASE = "https://open.spotify.com/album/";
export const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIPY_CLIENT_ID || "",
  clientSecret: process.env.SPOTIPY_CLIENT_SECRET || "",
  redirectUri: "http://localhost:8888/callback",
});

const daysBetween = (date1: Date, date2: Date) =>
  Math.abs((+date1 - +date2) / (1000 * 60 * 60 * 24));

// Main function to fetch and display albums
export async function scrape() {
  logger.info("Starting Better Release Radar...");

  await authenticateSpotify();

  deleteOldCacheFiles();

  let artists: Artist[];
  let albumCache = {};

  // Ensure that the cache directory exists
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
  }

  // Load cached artists if available
  if (fs.existsSync(artistCacheFile)) {
    artists = JSON.parse(fs.readFileSync(artistCacheFile, "utf8"));
    logger.info(`Loaded artists from cache: ${artistCacheFile}`);
  } else {
    artists = await fetchFollowedArtists();
    fs.writeFileSync(artistCacheFile, JSON.stringify(artists));
    logger.info("Fetched and cached followed artists");
  }

  // Load cached albums if available
  let isAlbumCacheLoaded = false;
  if (fs.existsSync(albumCacheFile)) {
    albumCache = JSON.parse(fs.readFileSync(albumCacheFile, "utf8"));
    logger.info(`Loaded albums from cache: ${albumCacheFile}`);
    isAlbumCacheLoaded = true;
  } else {
    logger.info("Fetching artists' albums...");
  }

  // Initialize the progress bar with the number of artists
  const overallProgressBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  overallProgressBar.start(artists.length, 0); // Total steps: number of artists

  const albums: Album[] = [];
  const todayDate = new Date();
  let filteredLogsBuffer = [];

  for (const artist of artists) {
    try {
      // Fetch albums for each artist with retry logic (auth refresh + backoff)
      const artistAlbums = await fetchArtistAlbumsWithRetry(
        artist.id,
        albumCache
      );

      for (const album of artistAlbums) {
        const albumDate = new Date(album.release_date);

        if (
          // Release date and release type filter
          daysBetween(todayDate, albumDate) <=
            parseInt(options.maxAgeDays, 10) &&
          (!options.region ||
            (album.available_markets &&
              album.available_markets.includes(options.region))) &&
          (!options.hideEps || album.album_type === "album")
        ) {
          // Live recording filter
          if (!options.showLiveRecordings && isLiveRecording(album.name)) {
            filteredLogsBuffer.push(
              `Filtered out live recording: ${album.name}`
            );
            continue;
          }

          // Re-release detection filter
          // Normalize the current album name and check if it already exists
          if (options.showReReleases && albumExists(album.name, artistAlbums)) {
            // If the album looks to have already been released on spotify, and it contains re-release terms, skip it
            if (isReRelease(album.name)) {
              filteredLogsBuffer.push(`Filtered out re-release: ${album.name}`);
              continue;
            }
          }

          // If no existing album is found, or this isn't a re-release, add the album
          const primaryArtist = album.artists[0]; // Use the first artist as the primary artist

          albums.push({
            name: album.name,
            release_date: album.release_date,
            url: options.showUrls
              ? `${SPOTIFY_ALBUM_URL_BASE}${album.id}`
              : album.uri,
            artist: primaryArtist, // Set the correct primary artist
            type: album.album_type as "album" | "single" | "compilation", // Cast to known types
          });
        }
      }

      // Cache the albums for this artist
      albumCache[artist.id] = artistAlbums;

      // Increment the progress bar after processing each artist
      overallProgressBar.increment();
    } catch (err) {
      logger.error(
        `Error fetching albums for artist ${artist.id}: ${err.message}`
      );
    }
  }

  // Stop the progress bar when complete
  overallProgressBar.stop();

  // Log any filtered albums
  filteredLogsBuffer.forEach((log) => logger.info(log));

  // Save the album cache to disk after successful fetching
  if (!isAlbumCacheLoaded) {
    fs.writeFileSync(albumCacheFile, JSON.stringify(albumCache, null, 2));
    logger.info(`Album cache saved successfully at ${albumCacheFile}`);
  }

  // Sort albums by release date
  albums.sort(
    (a, b) =>
      new Date(b.release_date).getTime() - new Date(a.release_date).getTime()
  );

  // Output the albums in a nice table format
  displayAlbums(albums);
}

async function main() {
  const isAuthenticated = await authenticateSpotify();
  if (isAuthenticated) {
    // If tokens were valid or refreshed, continue with main
    await scrape().catch((err) => {
      logger.error("Error running the script:", err);
    });
  } else {
    logger.info("Waiting for authorization before running main...");
  }
}

main();