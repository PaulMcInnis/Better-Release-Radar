import { RawAlbum } from "./interfaces";

// Define regular expressions to filter out re-releases
const reReleasePatterns = [
  /\bdeluxe\b/i,
  /\bremaster(ed)?\b/i,
  /\banniversary\b/i,
  /\bspecial edition\b/i,
  /\bexpanded\b/i,
  /\breissue\b/i,
  /\bbonus\b/i,
  /\bedition\b/i,
];

// Function to normalize album names by removing re-release terms, text in parentheses/brackets, and normalizing dashes/colons
export function normalizeAlbumName(albumName: string): string {
  // Remove terms in parentheses or brackets
  let normalized = albumName
    .replace(/\s*\(.*?\)\s*/g, "") // Remove text in parentheses
    .replace(/\s*\[.*?\]\s*/g, "") // Remove text in brackets
    .replace(/\s*-\s*/g, " ") // Normalize dashes to spaces
    .replace(/\s*:\s*/g, " "); // Normalize colons to spaces

  // Remove common re-release terms
  normalized = reReleasePatterns.reduce(
    (name, pattern) => name.replace(pattern, ""),
    normalized
  );

  return normalized.trim();
}

// Function to check if an album name is a re-release
export function isReRelease(albumName: string): boolean {
  return reReleasePatterns.some((pattern) => pattern.test(albumName));
}

// List of patterns to detect live recordings but avoid "LIVE" as part of the title
const liveRecordingPatterns = [
  /\blive at\b/i, // "Live at [Location]"
  /\bin concert\b/i, // "In Concert"
  /\blive recording\b/i, // "Live Recording"
  /\brecorded live\b/i, // "Recorded Live"
  /\blive version\b/i, // "Live Version"
  /\blive performance\b/i, // "Live Performance"
  /\blive from\b/i, // "Live From [Location]"
  /\blive in\b/i, // "Live In [Location]"
  /\blive on\b/i, // "Live On [Date]"
  /\bunplugged\b/i, // "Unplugged"
];

// Function to check if an album is a live recording (using patterns but ignoring simple titles like "Live")
export function isLiveRecording(albumName: string): boolean {
  return liveRecordingPatterns.some((pattern) => pattern.test(albumName));
}

// Function to check if an album with the same normalized name already exists
export function albumExists(
  albumName: string,
  existingAlbums: RawAlbum[]
): boolean {
  const normalizedAlbumName = normalizeAlbumName(albumName);
  return existingAlbums.some(
    (existingAlbum) =>
      normalizeAlbumName(existingAlbum.name).toLowerCase() ===
      normalizedAlbumName.toLowerCase()
  );
}
