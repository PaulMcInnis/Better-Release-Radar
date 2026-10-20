# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Better-Release-Radar is a TypeScript CLI tool that helps users track new album releases from their followed Spotify artists. It uses Spotify's Web API to fetch artist data and recent releases, applying customizable filters to display relevant albums in a formatted table.

## Commands

### Development Commands
- `npm start` - Run the main application
- `npm start -- --help` - Show CLI options
- `npm run html -- out/releases.json [out.html] [--open]` - Rebuild the HTML page from a JSON report
- `npm run typecheck` - Strict TypeScript check

### Common Usage Examples
```bash
# Show releases from last 90 days, hide EPs, show URLs for US region
npm start -- --max-age-days 90 --hide-eps --show-urls --region US

# Filter out various release types from the last year
npm start -- --max-age-days 360 --hide-re-releases --hide-live-recordings --hide-soundtracks --hide-remixes
```

## Architecture

### Core Components

**Entry Point**: `src/main.ts` - Contains the main application logic and orchestrates the entire flow:
1. Authentication with Spotify
2. Fetching followed artists (with caching)
3. Fetching albums for each artist
4. Looking up record labels for releases in range
5. Tagging releases and applying filters based on CLI options
6. Displaying results in a table, and optionally writing JSON and an HTML page

**Key Modules**:
- `auth.ts` - Handles Spotify OAuth flow with local callback server
- `cache.ts` - Manages file-based caching for tokens, artists, and albums with date-based cache files
- `cli.ts` - Command-line argument parsing using Commander.js
- `fetch.ts` - Spotify API calls with retry logic and rate limiting
- `filters.ts` - Release tagging (re-releases, live recordings, soundtracks, remixes) and EP detection
- `display.ts` - Table formatting and console output
- `output.ts` - JSON report, HTML page rendering and opening it in a browser (no CLI/logger imports)
- `html/template.html` - Self-contained page template; the report JSON is embedded at `__REPORT_JSON__`
- `build-html.ts` - Standalone entry point for `npm run html`
- `interfaces.ts` - TypeScript type definitions

### Data Flow

1. **Authentication**: OAuth tokens are cached in `.cache/spotify_tokens.json`
2. **Artist Fetching**: Followed artists cached daily in `.cache/followed_artists_YYYY-MM-DD.json`
3. **Album Fetching**: Artists fetched 10 at a time; albums cached daily in `.cache/album_cache_v2_YYYY-MM-DD.json` (bump the version when `RawAlbum` gains fields)
4. **Labels**: Fetched 20 albums per request for releases in range only, cached across days in `.cache/album_labels.json`
5. **Filtering**: Age and region are applied while fetching; type and tag filters only hide releases from the console table. JSON/HTML keep everything, tagged, with the hidden types/tags recorded so the page starts with them hidden
6. **Display**: Sorted by release date (newest first) in CLI table format

### Environment Requirements

**Required Environment Variables**:
- `SPOTIPY_CLIENT_ID` - Spotify application client ID
- `SPOTIPY_CLIENT_SECRET` - Spotify application client secret  
- `SPOTIPY_REDIRECT_URI` - Must be `http://127.0.0.1:8888/callback` (Spotify rejects `localhost`). The callback server listens on `0.0.0.0` so a Windows browser can reach it inside WSL2

**Node.js**: Requires Node.js >= 23.6.0 (specified in package.json engines)

### Caching Strategy

The application uses aggressive file-based caching to minimize API calls:
- Token cache persists across sessions until refresh needed
- Artist and album caches are date-based (daily refresh)
- Dated cache files older than 7 days are deleted; the token file and label cache are kept
- Cache directory `.cache/` is created automatically

### TypeScript Configuration

- Uses ES modules with `"type": "module"` in package.json
- Configured for Node.js with `"module": "NodeNext"`
- Strict type checking enabled with additional safety flags
- No emit compilation (`"noEmit": true`) - runs TypeScript files directly