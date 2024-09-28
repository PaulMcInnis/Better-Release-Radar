import { logger } from "./logger";
import http from "http";
import { saveTokensToCache, loadTokensFromCache } from "./cache";
import { scrape, spotifyApi } from "./main";

// Step 1: Generate an Authorization URL
function getAuthorizationURL() {
  const authorizeURL = spotifyApi.createAuthorizeURL(
    ["user-follow-read"],
    "random-state"
  );
  logger.info("Prompting user to authorize the app");
  console.log(`
  --------------------------------------------------
  Authorize your app by visiting this URL:
  ${authorizeURL}
  --------------------------------------------------
  `);
}

// Step 4: Exchange Authorization Code for Access Token and Refresh Token
async function exchangeAuthorizationCode(code: string) {
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);
    saveTokensToCache(access_token, refresh_token);
    logger.info("Access token and refresh token set.");
  } catch (err) {
    console.error("Error exchanging authorization code:", err);
  }
}

// Step 5: Use refresh token to get a new access token (if needed)
export async function refreshAccessToken() {
  logger.info("Refreshing access token...");
  try {
    const tokens = loadTokensFromCache(); // Load tokens before trying to refresh
    if (!tokens || !tokens.refreshToken) {
      throw new Error("Refresh token is missing from cache"); // Handle missing refresh token case
    }

    // Set the refresh token in the spotifyApi instance
    spotifyApi.setRefreshToken(tokens.refreshToken);

    // Attempt to refresh the access token using the refresh token
    const data = await spotifyApi.refreshAccessToken();
    const accessToken = data.body["access_token"];

    // Update the spotifyApi instance with the new access token
    spotifyApi.setAccessToken(accessToken);

    // Save the new access token, but keep the same refresh token in the cache
    saveTokensToCache(accessToken, tokens.refreshToken);

    logger.info("Access token has been refreshed.");
  } catch (err) {
    console.error("Error refreshing access token", err);
  }
}
// Step 6: Authenticate Spotify (Use cached tokens or refresh if needed)
export async function authenticateSpotify(): Promise<boolean> {
  const tokens = loadTokensFromCache();

  if (tokens && tokens.expiresAt > Date.now()) {
    // Cached tokens are valid, proceed with authentication
    spotifyApi.setAccessToken(tokens.accessToken);
    spotifyApi.setRefreshToken(tokens.refreshToken);
    logger.info("Using cached Spotify tokens.");
    return true; // Return true since authentication is successful
  } else if (tokens && tokens.refreshToken) {
    // If tokens exist but access token is expired, refresh the token
    await refreshAccessToken();
    return true; // After refreshing, return true
  } else {
    // No valid tokens, need to authenticate
    getAuthorizationURL();
    startLocalServer();
    return false; // Indicate that manual authorization is needed
  }
}

// By running a local server to receive the authorization code, we can automate the process of getting the code from the user.
function startLocalServer() {
  const server = http.createServer(async (req, res) => {
    if (req.url && req.url.startsWith("/callback")) {
      const url = new URL(req.url, `http://localhost:8888`);
      const code = url.searchParams.get("code");

      if (code) {
        logger.info("Authorization code received:", code);
        await exchangeAuthorizationCode(code);

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Authorization successful! You can close this window.");

        server.close();

        // After successful authorization, call main
        scrape().catch((err) => {
          logger.error("Error running the script:", err);
        });
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("No authorization code found.");
      }
    }
  });

  server.listen(8888, () => {
    logger.info(
      "Listening for Spotify authorization code on http://localhost:8888/callback"
    );
  });
}
