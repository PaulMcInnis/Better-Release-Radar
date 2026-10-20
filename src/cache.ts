// Dead-simple caching for Spotify API requests to make it easier to experiment with data without hitting API rate limits.
import * as fs from "fs";
import * as path from "path";
import { Artist, RawAlbum } from "./interfaces";
import { logger } from "./logger";

const today = new Date().toISOString().split("T")[0];
export const cacheDir = path.resolve(__dirname, "../.cache");
export const tokenCacheFile = path.join(cacheDir, "spotify_tokens.json");
export const artistCacheFile = path.join(
  cacheDir,
  `followed_artists_${today}.json`
);
// Bump the version whenever RawAlbum gains fields, so stale caches are ignored
export const albumCacheFile = path.join(cacheDir, `album_cache_v2_${today}.json`);

export type AlbumCache = { [artistId: string]: RawAlbum[] };

export function ensureCacheDirectoryExists() {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
  }
}

export function saveTokensToCache(
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number = 3600
) {
  ensureCacheDirectoryExists();
  const tokens = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
  fs.writeFileSync(tokenCacheFile, JSON.stringify(tokens));
}

export function loadTokensFromCache(): {
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

// Artist and album caches are only reused on the day they were written, so old ones are dead weight.
// The token file is kept regardless of age: its refresh token stays valid until revoked.
export function deleteOldCacheFiles(maxAgeDays: number = 7) {
  const now = Date.now();
  fs.readdirSync(cacheDir).forEach((file) => {
    const filePath = path.join(cacheDir, file);
    if (filePath === tokenCacheFile) return;
    const stats = fs.statSync(filePath);
    const fileAgeDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    if (fileAgeDays > maxAgeDays) {
      fs.unlinkSync(filePath);
      logger.info(`Deleted old cache file: ${file}`);
    }
  });
}

export function loadArtistCache(): Artist[] | null {
  if (fs.existsSync(artistCacheFile)) {
    return JSON.parse(fs.readFileSync(artistCacheFile, "utf8"));
  }
  return null;
}

export function saveArtistCache(artists: Artist[]) {
  fs.writeFileSync(artistCacheFile, JSON.stringify(artists));
}

export function loadAlbumCache(): AlbumCache | null {
  if (fs.existsSync(albumCacheFile)) {
    return JSON.parse(fs.readFileSync(albumCacheFile, "utf8"));
  }
  return null;
}

export function saveAlbumCache(cache: AlbumCache) {
  fs.writeFileSync(albumCacheFile, JSON.stringify(cache));
}
