// TypeScript Interfaces for data structures
export interface Artist {
  id: string;
  name: string;
}

// Spotify's own album types; EPs are reported as "single"
export type SpotifyAlbumType = "album" | "single" | "compilation";

// The type we display, which splits EPs out from singles
export type ReleaseType = SpotifyAlbumType | "ep";

export type ReleaseTag = "re-release" | "live" | "soundtrack" | "remix";

export interface AlbumImage {
  url: string;
  width: number | null;
  height: number | null;
}

// FIXME: this type should be defined by spotipy api
// https://developer.spotify.com/documentation/web-api/reference/get-multiple-albums

export interface RawAlbum {
  name: string;
  release_date: string;
  release_date_precision?: "year" | "month" | "day";
  uri: string;
  id: string;
  album_type: SpotifyAlbumType;
  total_tracks?: number;
  available_markets?: string[];
  artists: string[]; // Array of artist names associated with the album
  images?: AlbumImage[]; // Largest first, as returned by Spotify
}

// A release that passed the age and region checks, with everything needed to display it
export interface Release {
  id: string;
  name: string;
  artist: string; // Primary (followed) artist
  artistId: string;
  artists: string[];
  releaseDate: string;
  type: ReleaseType;
  totalTracks: number | null;
  tags: ReleaseTag[];
  uri: string;
  url: string;
  image: string | null; // ~300px cover
  thumbnail: string | null; // ~64px cover
}

// What --json writes and what the HTML page is built from
export interface Report {
  generatedAt: string;
  region: string | null;
  maxAgeDays: number;
  artistCount: number;
  // Types and tags hidden by the CLI flags; the HTML page starts with these hidden
  hidden: {
    types: ReleaseType[];
    tags: ReleaseTag[];
  };
  releases: Release[];
}
