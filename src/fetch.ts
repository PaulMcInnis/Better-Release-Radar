import { refreshAccessToken } from "./auth.ts";
import { saveAlbumCache } from "./cache.ts";
import type { Artist, RawAlbum } from "./interfaces.ts";
import { logger } from "./logger.ts";
import { spotifyApi } from "./main.ts";

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
  } catch (err) {
    logger.error("Error fetching followed artists:", err);
    throw err;
  }
}

// Fetch artist albums with cache support
export async function fetchArtistAlbums(
  artistId: string,
  cache: { [artistId: string]: RawAlbum[] }
): Promise<RawAlbum[]> {
  if (cache[artistId]) {
    // Use cached albums if available
    logger.debug(`Using cached albums for artist ${artistId}`);
    return cache[artistId];
  }

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

    // Cache the albums for this artist
    cache[artistId] = albums;
    saveAlbumCache(cache); // Save the updated cache to disk

    return albums;
  } catch (err) {
    logger.error(`Error fetching albums for artist ${artistId}`, err);
    throw err;
  }
}

// Retry mechanism with token refresh for auth issues and exponential backoff for other errors
export async function fetchArtistAlbumsWithRetry(
  artistId: string,
  cache: { [artistId: string]: RawAlbum[] }
): Promise<RawAlbum[]> {
  let retries = 3; // Max number of retries for non-auth errors
  let backoffDelay = 500; // Initial backoff delay in milliseconds

  while (retries > 0) {
    try {
      // Try fetching artist albums
      return await fetchArtistAlbums(artistId, cache);
    } catch (err) {
      if (
        err.body &&
        err.body.error &&
        err.body.error.status === 401 &&
        err.body.error.message === "The access token expired"
      ) {
        // If it's an authentication issue (token expired), refresh the token and retry immediately
        logger.info("Access token expired. Refreshing token...");
        await refreshAccessToken();
        continue; // Retry immediately after refreshing token (no backoff needed)
      } else {
        // For non-authentication errors, apply exponential backoff
        retries -= 1;
        if (retries > 0) {
          logger.info(
            `Error occurred, retrying after ${
              backoffDelay / 1000
            } seconds... (${retries} retries left)`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay)); // Wait for backoff period
          backoffDelay *= 2; // Exponential backoff (double the delay)
        } else {
          // If out of retries, rethrow the error
          throw err;
        }
      }
    }
  }
}
