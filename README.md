# Better-Release-Radar

This script makes it easy to see all the new album and EP releases by artists you follow on Spotify.

No more fussing around looking through a `New Releases` playlist of only 30 songs with bad visibility—now you can look at everything in one neat table!

### Example Output:

![Example](https://github.com/PaulMcInnis/Better-Release-Radar/blob/master/example.png)

### Requirements

This project requires `Node.js` and `npm` to run. It uses TypeScript to manage type safety.

### Authentication

You will need to [set up authentication with Spotify](https://developer.spotify.com/documentation/general/guides/authorization-guide/) such that:

- Your `REDIRECT_URI` for your [Spotify application](https://developer.spotify.com/dashboard/applications) is `http://localhost:8888/callback`
- Set the following environment variables (e.g., in your `.bashrc`, `.zshrc`, or via an `.env` file):

  ```
  export SPOTIPY_CLIENT_ID='your-spotify-client-id'
  export SPOTIPY_CLIENT_SECRET='your-spotify-client-secret'
  export SPOTIPY_REDIRECT_URI='http://localhost:8888/callback'
  ```

You can always access or rotate your client ID and secret at the [developer dashboard](https://developer.spotify.com/dashboard/).

### Installation

1. Clone the repository and navigate to the project directory:

   ```
   git clone https://github.com/PaulMcInnis/Better-Release-Radar.git
   cd Better-Release-Radar
   ```

2. Install the required dependencies:

   ```
   npm install
   ```

### Usage

To run the script, simply use the following command:

    npm start

#### CLI Options:

    usage: npm start [-- <options>]

    Options:
      --max-age-days MAX_AGE_DAYS   Maximum number of days to consider for new releases (default: 60)
      --hide-eps                    Hide EPs, only show full-length releases
      --show-urls                   Show full URLs instead of Spotify URIs
      --log-file LOG_FILE           Path to log file (default: log.log)
      --log-level LOG_LEVEL         Logging level (default: info)
      --region REGION               ISO 3166-1 alpha-2 region code to filter albums by availability (default: CA)

### Example Usage:

    npm start -- --max-age-days 90 --hide-eps --show-urls --region US

This will show full album releases from the last 90 days, displaying the full URLs for albums available in the US region.

**NOTE: cmd+click in OSX will open the URL, but this is going to use spotify web, so fastest UX is to copy-paste the URI into spotify**

### Features:

- **Cached Authentication**: The script caches the Spotify access token, so you won't need to re-authenticate each time. If the access token expires, it will automatically refresh using the stored refresh token.
- **Fuzzy Matching**: The script uses fuzzy matching to filter out albums with similar names to avoid duplicates.
- **Customizable Parameters**: You can filter results by album age, hide EPs, and limit results to a specific region.

### How It Works:

1. **Authentication**: The script handles Spotify's OAuth flow. It will prompt you to authorize the app and then cache the access and refresh tokens for future use.
2. **Fetching Followed Artists**: After authentication, the script retrieves the list of artists you follow.
3. **Fetching Albums**: The script then fetches recent albums from these artists, applying filters for release date, region, and album type.
4. **Displaying Results**: The final results are displayed in a tabular format in your terminal.

### Troubleshooting:

- **Insufficient Client Scope**: If you see an error about "insufficient client scope," ensure your Spotify application has the correct `user-follow-read` scope configured.
- **Token Expiration**: If the token expires and the refresh token fails, you may need to re-authenticate by manually deleting the `spotify_tokens.json` file in the `.cache` directory.

Happy tracking your favorite artists' releases!
