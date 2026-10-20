import cliProgress from "cli-progress";
import SpotifyWebApi from "spotify-web-api-node";
import { authenticateSpotify } from "./auth";
import {
  AlbumCache,
  deleteOldCacheFiles,
  ensureCacheDirectoryExists,
  loadAlbumCache,
  loadArtistCache,
  saveAlbumCache,
  saveArtistCache,
} from "./cache";
import { options } from "./cli";
import { displayAlbums } from "./display";
import { fetchArtistAlbumsWithRetry, fetchFollowedArtists } from "./fetch";
import { getReleaseType, getTags, normalizeAlbumName } from "./filters";
import { Artist, RawAlbum, Release, ReleaseTag, ReleaseType } from "./interfaces";
import { logger } from "./logger";
import { openInBrowser, writeHtml, writeJson } from "./output";

// Set up Spotify API
const SPOTIFY_ALBUM_URL_BASE = "https://open.spotify.com/album/";
export const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIPY_CLIENT_ID || "",
  clientSecret: process.env.SPOTIPY_CLIENT_SECRET || "",
  redirectUri: "http://127.0.0.1:8888/callback",
});

const daysBetween = (date1: Date, date2: Date) =>
  Math.abs((+date1 - +date2) / (1000 * 60 * 60 * 24));

// Save partial progress every so often, so a crash mid-run doesn't lose everything
const ALBUM_CACHE_SAVE_INTERVAL = 50;

// Which types and tags the CLI flags hide
function hiddenFromOptions(): { types: ReleaseType[]; tags: ReleaseTag[] } {
  const tags: ReleaseTag[] = [];
  if (options.hideReReleases) tags.push("re-release");
  if (options.hideLiveRecordings) tags.push("live");
  if (options.hideSoundtracks) tags.push("soundtrack");
  if (options.hideRemixes) tags.push("remix");
  return {
    types: options.hideEps ? ["single", "ep", "compilation"] : [],
    tags,
  };
}

function toRelease(album: RawAlbum, artist: Artist): Release {
  // Spotify lists images largest first, typically 640px, 300px and 64px
  const images = [...(album.images ?? [])].sort(
    (a, b) => (b.width ?? 0) - (a.width ?? 0)
  );
  const image =
    images.find((img) => (img.width ?? 0) <= 300) ?? images[0] ?? null;
  const thumbnail = images[images.length - 1] ?? null;

  return {
    id: album.id,
    name: album.name,
    artist: album.artists[0], // The primary artist is the followed artist
    artistId: artist.id,
    artists: album.artists,
    releaseDate: album.release_date,
    type: getReleaseType(album),
    totalTracks: album.total_tracks ?? null,
    tags: getTags(album.name),
    uri: album.uri,
    url: `${SPOTIFY_ALBUM_URL_BASE}${album.id}`,
    image: image ? image.url : null,
    thumbnail: thumbnail ? thumbnail.url : null,
  };
}

// Spotify often lists the same release more than once (e.g. per-market or re-uploaded copies)
function dedupeReleases(releases: Release[]): Release[] {
  const seen = new Set<string>();
  return releases.filter((release) => {
    const key = `${release.artistId}|${release.type}|${normalizeAlbumName(
      release.name
    )}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Main function to fetch and display albums
export async function scrape() {
  logger.info("Starting Better Release Radar...");

  ensureCacheDirectoryExists();
  deleteOldCacheFiles();

  // Load cached artists if available
  let artists = loadArtistCache();
  if (artists) {
    logger.info("Loaded followed artists from today's cache");
  } else {
    artists = await fetchFollowedArtists();
    saveArtistCache(artists);
    logger.info("Fetched and cached followed artists");
  }

  // Load cached albums if available
  let albumCache: AlbumCache = loadAlbumCache();
  if (albumCache) {
    logger.info("Loaded albums from today's cache");
  } else {
    albumCache = {};
    logger.info("Fetching artists' albums...");
  }

  // Initialize the progress bar with the number of artists
  const overallProgressBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  overallProgressBar.start(artists.length, 0); // Total steps: number of artists

  const releases: Release[] = [];
  const failedArtists: Artist[] = [];
  const todayDate = new Date();
  const maxAgeDays = parseInt(options.maxAgeDays, 10);

  for (const [index, artist] of artists.entries()) {
    try {
      // Fetch albums for each artist with retry logic (auth refresh + backoff)
      const artistAlbums = await fetchArtistAlbumsWithRetry(
        artist.id,
        albumCache
      );

      for (const album of artistAlbums) {
        const albumDate = new Date(album.release_date);

        // Release date and region filter. Type and tag filters are applied per output below.
        if (
          daysBetween(todayDate, albumDate) <= maxAgeDays &&
          (!options.region ||
            (album.available_markets &&
              album.available_markets.includes(options.region)))
        ) {
          releases.push(toRelease(album, artist));
        }
      }
    } catch (err) {
      failedArtists.push(artist);
      logger.debug(
        `Error fetching albums for artist ${artist.name} (${artist.id}): ${err.message}`
      );
    }

    // Increment the progress bar after processing each artist
    overallProgressBar.increment();

    if ((index + 1) % ALBUM_CACHE_SAVE_INTERVAL === 0) {
      saveAlbumCache(albumCache);
    }
  }

  // Stop the progress bar when complete
  overallProgressBar.stop();

  // Save the album cache to disk, including artists that failed in an earlier run today
  saveAlbumCache(albumCache);

  if (failedArtists.length > 0) {
    logger.warn(
      `Couldn't fetch albums for ${failedArtists.length} artist(s): ${failedArtists
        .map((artist) => artist.name)
        .join(", ")}`
    );
  }

  // Sort albums by release date, newest first
  const allReleases = dedupeReleases(
    releases.sort(
      (a, b) =>
        new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    )
  );

  // NOTE: the tag filters can be a bit too aggressive, but we log what they hide (--log-filtered),
  // and the JSON/HTML outputs keep everything so hidden releases can be toggled back on.
  const hidden = hiddenFromOptions();
  const visibleReleases = allReleases.filter((release) => {
    const hiddenTag = release.tags.find((tag) => hidden.tags.includes(tag));
    const hiddenType = hidden.types.includes(release.type);
    if (hiddenTag || hiddenType) {
      if (options.logFiltered) {
        logger.info(
          `Filtered out ${hiddenTag ?? release.type}: ${release.artist} - ${
            release.name
          } - ${release.uri}`
        );
      }
      return false;
    }
    return true;
  });

  // Output the albums in a nice table format
  if (options.table) {
    displayAlbums(visibleReleases, options.showUrls);
  }
  logger.info(
    `Found ${allReleases.length} releases, showing ${visibleReleases.length} after filters.`
  );

  const report = {
    generatedAt: todayDate.toISOString(),
    region: options.region || null,
    maxAgeDays,
    artistCount: artists.length,
    hidden,
    releases: allReleases,
  };

  if (options.json) {
    writeJson(report, options.json);
    logger.info(`Wrote JSON to ${options.json}`);
  }
  if (options.html) {
    writeHtml(report, options.html);
    logger.info(`Wrote HTML page to ${options.html}`);
    if (options.open) {
      openInBrowser(options.html);
    }
  }
}

async function main() {
  const isAuthenticated = await authenticateSpotify();
  if (isAuthenticated) {
    // If tokens were valid or refreshed, continue with main
    await scrape().catch((err) => {
      logger.error(`Error running the script: ${err.message}`);
    });
  } else {
    logger.info("Waiting for authorization before running main...");
  }
}

main();
