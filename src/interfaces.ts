// TypeScript Interfaces for data structures
export interface Artist {
  id: string;
  name: string;
}

export interface Album {
  name: string;
  release_date: string;
  url: string;
  artist: string;
  type: "album" | "single" | "compilation";
}

// FIXME: this type should be defined by spotipy api
// https://developer.spotify.com/documentation/web-api/reference/get-multiple-albums

export interface RawAlbum {
  name: string;
  release_date: string;
  uri: string;
  id: string;
  album_type: "album" | "single" | "compilation";
  available_markets?: string[];
  artists: string[]; // Array of artist names associated with the album
}
