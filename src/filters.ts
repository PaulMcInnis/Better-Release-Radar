// Define regular expressions to filter out re-releases
const reReleasePatterns = [
  /\bdeluxe\b/i,
  /\b(remaster(ed)?|remastered)\b/i, // Cover both "remaster" and "remastered"
  /\banniversary\b/i,
  /\b\d{1,2}\s*year\s*(anniversary|edition)\b/i, // Cover cases like "10 Year Anniversary" and "10 Year Edition"
  /\bspecial\s*edition\b/i,
  /\bexpanded\s*edition\b/i, // Expanded Edition fix
  /\bexpanded\b/i,
  /\breissue\b/i,
  /\bbonus\b/i,
  /\bedition\b/i, // Catch any remaining cases where "edition" is used
];

export function normalizeAlbumName(albumName: string): string {
  let normalized = albumName
    .toLowerCase()
    .replace(/[\(\)\[\]]/g, "") // Remove parentheses and brackets
    .replace(/\s*-\s*/g, " ") // Normalize dashes to spaces
    .replace(/\s*:\s*/g, " ") // Normalize colons to spaces
    .replace(/\s+/g, " ") // Normalize multiple spaces to a single space
    .trim();
  return normalized;
}

// Function to check if an album name is a re-release
export function isReRelease(albumName: string): boolean {
  const normalizedAlbumName = normalizeAlbumName(albumName);
  return reReleasePatterns.some((pattern) => pattern.test(normalizedAlbumName));
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
  /\blive\b/i, // "Live" (generic)
];

// Function to check if an album is a live recording (using patterns but ignoring simple titles like "Live")
export function isLiveRecording(normalizedAlbumName: string): boolean {
  return liveRecordingPatterns.some((pattern) =>
    pattern.test(normalizedAlbumName)
  );
}

const soundtrackPatterns = [/\bsoundtrack\b/i, /\bost\b/i];

// Function to check if an album is a soundtrack
export function isSoundtrack(normalizedAlbumName: string): boolean {
  return soundtrackPatterns.some((pattern) =>
    pattern.test(normalizedAlbumName)
  );
}

const remixPatterns = [
  /\bremix\b/i,
  /\brework\b/i,
  /\bedit\b/i,
  /\bversion\b/i,
  /\bremake\b/i,
  /\bremixed\b/i,
];

// Function to check if an album is a remix
export function isRemix(normalizedAlbumName: string): boolean {
  return remixPatterns.some((pattern) => pattern.test(normalizedAlbumName));
}
