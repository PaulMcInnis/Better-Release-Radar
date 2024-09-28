// Dead-simple caching for Spotify API requests to make it easier to experiment with data without hitting API rate limits.
import * as fs from "fs";
import * as path from "path";

import { logger } from "./logger";

const today = new Date();
export const cacheDir = path.resolve(__dirname, "../.cache");
export const tokenCacheFile = path.join(cacheDir, "spotify_tokens.json");
export const artistCacheFile = path.join(
  cacheDir,
  `followed_artists_${today.toISOString().split("T")[0]}.json`
);
export const albumCacheFile = path.join(
  cacheDir,
  `album_cache_${today.toISOString().split("T")[0]}.json`
);

export function ensureCacheDirectoryExists() {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
  }
}

export function saveTokensToCache(accessToken: string, refreshToken: string) {
  const tokens = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + 3600 * 1000, // Set expiry for 1 hour
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

export function deleteOldCacheFiles(maxAgeDays: number = 60) {
  const now = Date.now();
  fs.readdirSync(cacheDir).forEach((file) => {
    const filePath = path.join(cacheDir, file);
    const stats = fs.statSync(filePath);
    const fileAgeDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    if (fileAgeDays > maxAgeDays) {
      fs.unlinkSync(filePath);
      logger.info(`Deleted old cache file: ${file}`);
    }
  });
}

export function saveAlbumCache(cache: { [artistId: string]: any[] }) {
  fs.writeFileSync(albumCacheFile, JSON.stringify(cache, null, 2));
}

export function loadArtistCache() {
  if (fs.existsSync(artistCacheFile)) {
    return JSON.parse(fs.readFileSync(artistCacheFile, "utf8"));
  }
  return null;
}

export function saveArtistCache(artists: any[]) {
  fs.writeFileSync(artistCacheFile, JSON.stringify(artists));
}

export function loadAlbumCache() {
  if (fs.existsSync(albumCacheFile)) {
    return JSON.parse(fs.readFileSync(albumCacheFile, "utf8"));
  }
  return null;
}
