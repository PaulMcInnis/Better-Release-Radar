import { refreshAccessToken } from "./auth.ts";
import type { AlbumCache, LabelCache } from "./cache.ts";
import type { Artist, RawAlbum } from "./interfaces.ts";
import { logger } from "./logger.ts";
import { spotifyApi } from "./main.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to fetch followed artists with a progress bar
export async function fetchFollowedArtists(): Promise<Artist[]> {
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
  } catch (err: any) {
    logger.error(`Error fetching followed artists: ${err.message}`);
    throw err;
  }
}

// Fetch artist albums with cache support
export async function fetchArtistAlbums(
  artistId: string,
  cache: AlbumCache
): Promise<RawAlbum[]> {
  if (cache[artistId]) {
    // Use cached albums if available
    logger.debug(`Using cached albums for artist ${artistId}`);
    return cache[artistId];
  }

  let albums: RawAlbum[] = [];
  let offset = 0;
  const limit = 50; // Spotify API allows a maximum of 50 items per request

  let response;
  do {
    // Fetch albums in batches using the offset for pagination.
    // Skip "appears_on", which is never the followed artist's own release.
    response = await spotifyApi.getArtistAlbums(artistId, {
      limit,
      offset,
      include_groups: "album,single,compilation",
    });
    const fetchedAlbums: RawAlbum[] = response.body.items
      .filter((album) => album.artists[0]?.id === artistId) // Ensure the followed artist is the primary artist
      .map((album) => ({
        name: album.name,
        release_date: album.release_date,
        release_date_precision: album.release_date_precision,
        uri: album.uri,
        id: album.id,
        album_type: album.album_type,
        total_tracks: album.total_tracks,
        available_markets: album.available_markets,
        artists: album.artists.map((artist) => artist.name), // Extract artist names
        images: album.images.map((image) => ({
          url: image.url,
          width: image.width ?? null,
          height: image.height ?? null,
        })),
      }));

    albums = albums.concat(fetchedAlbums); // Append the newly fetched albums to the result
    offset += limit; // Move the offset for the next batch
  } while (response.body.next); // Continue while Spotify reports another page

  // Cache the albums for this artist
  cache[artistId] = albums;

  return albums;
}

// Retry mechanism with token refresh for auth issues and exponential backoff for other errors
async function withRetry<T>(
  description: string,
  request: () => Promise<T>
): Promise<T> {
  let retries = 5; // Max number of attempts for non-auth errors
  let backoffDelay = 1000; // Initial backoff delay in milliseconds
  let refreshedToken = false;

  while (true) {
    try {
      return await request();
    } catch (err: any) {
      if (err.statusCode === 401 && !refreshedToken) {
        // If it's an authentication issue (token expired), refresh the token once and retry immediately
        logger.info("Access token expired. Refreshing token...");
        refreshedToken = true;
        await refreshAccessToken();
        continue; // Retry immediately after refreshing token (no backoff needed)
      }

      retries -= 1;
      if (retries <= 0) {
        // If out of retries, rethrow the error
        throw err;
      }

      // Rate limited: Spotify says how long to wait. Otherwise use exponential backoff.
      const retryAfterSeconds = Number(err.headers?.["retry-after"]);
      const delay =
        err.statusCode === 429 && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : backoffDelay;
      logger.debug(
        `${description} failed (${
          err.statusCode || err.code || err.message || err.name || "unknown error"
        }), retrying after ${delay / 1000} seconds... (${retries} retries left)`
      );
      await sleep(delay);
      backoffDelay *= 2; // Exponential backoff (double the delay)
    }
  }
}

export function fetchArtistAlbumsWithRetry(
  artistId: string,
  cache: AlbumCache
): Promise<RawAlbum[]> {
  return withRetry(`Fetching albums for artist ${artistId}`, () =>
    fetchArtistAlbums(artistId, cache)
  );
}

// The artist albums endpoint doesn't include labels, so look them up in batches
// of 20 (the most Spotify allows) and add them to the label cache
export async function fetchAlbumLabels(
  albumIds: string[],
  labelCache: LabelCache
): Promise<void> {
  const missing = [...new Set(albumIds)].filter((id) => !(id in labelCache));
  const batchSize = 20;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    try {
      const response = await withRetry("Fetching album labels", () =>
        spotifyApi.getAlbums(batch)
      );
      batch.forEach((id, index) => {
        labelCache[id] = response.body.albums[index]?.label?.trim() || null;
      });
    } catch (err: any) {
      // Labels are a nice-to-have; leave these uncached so the next run tries again
      logger.warn(`Couldn't fetch labels for ${batch.length} albums: ${err.message}`);
    }
  }
}
