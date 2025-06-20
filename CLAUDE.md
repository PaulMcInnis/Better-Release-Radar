# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Better-Release-Radar is a TypeScript CLI tool that helps users track new album releases from their followed Spotify artists. It uses Spotify's Web API to fetch artist data and recent releases, applying customizable filters to display relevant albums in a formatted table.

## Commands

### Development Commands
- `npm start` - Run the main application
- `npm start -- --help` - Show CLI options
- `node src/main.ts` - Direct execution (equivalent to npm start)

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
4. Applying filters based on CLI options
5. Displaying results in a table format

**Key Modules**:
- `auth.ts` - Handles Spotify OAuth flow with local callback server
- `cache.ts` - Manages file-based caching for tokens, artists, and albums with date-based cache files
- `cli.ts` - Command-line argument parsing using Commander.js
- `fetch.ts` - Spotify API calls with retry logic and rate limiting
- `filters.ts` - Album filtering logic (re-releases, live recordings, soundtracks, remixes)
- `display.ts` - Table formatting and console output
- `interfaces.ts` - TypeScript type definitions

### Data Flow

1. **Authentication**: OAuth tokens are cached in `.cache/spotify_tokens.json`
2. **Artist Fetching**: Followed artists cached daily in `.cache/followed_artists_YYYY-MM-DD.json`
3. **Album Fetching**: Albums cached daily in `.cache/album_cache_YYYY-MM-DD.json`
4. **Filtering**: Multiple filter passes based on CLI flags (age, type, region, content filters)
5. **Display**: Sorted by release date (newest first) in CLI table format

### Environment Requirements

**Required Environment Variables**:
- `SPOTIPY_CLIENT_ID` - Spotify application client ID
- `SPOTIPY_CLIENT_SECRET` - Spotify application client secret  
- `SPOTIPY_REDIRECT_URI` - Must be `http://localhost:8888/callback`

**Node.js**: Requires Node.js >= 23.6.0 (specified in package.json engines)

### Caching Strategy

The application uses aggressive file-based caching to minimize API calls:
- Token cache persists across sessions until refresh needed
- Artist and album caches are date-based (daily refresh)
- Cache files are automatically cleaned up when outdated
- Cache directory `.cache/` is created automatically

### TypeScript Configuration

- Uses ES modules with `"type": "module"` in package.json
- Configured for Node.js with `"module": "NodeNext"`
- Strict type checking enabled with additional safety flags
- No emit compilation (`"noEmit": true`) - runs TypeScript files directly