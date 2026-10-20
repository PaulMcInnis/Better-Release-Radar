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
    const { access_token, refresh_token, expires_in } = data.body;
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);
    saveTokensToCache(access_token, refresh_token, expires_in);
    logger.info("Access token and refresh token set.");
  } catch (err) {
    logger.error(`Error exchanging authorization code: ${err.message}`);
  }
}

// Step 5: Use refresh token to get a new access token (if needed)
// Returns false when the refresh token is missing or rejected, e.g. after rotating the client secret
export async function refreshAccessToken(): Promise<boolean> {
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
    // Spotify may rotate the refresh token; keep the old one if it doesn't
    const refreshToken = data.body["refresh_token"] || tokens.refreshToken;

    // Update the spotifyApi instance with the new access token
    spotifyApi.setAccessToken(accessToken);

    saveTokensToCache(accessToken, refreshToken, data.body["expires_in"]);

    logger.info("Access token has been refreshed.");
    return true;
  } catch (err) {
    logger.error(`Error refreshing access token: ${err.message}`);
    return false;
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
  }

  // If tokens exist but access token is expired, refresh the token
  if (tokens && tokens.refreshToken && (await refreshAccessToken())) {
    return true;
  }

  // No valid tokens, or the refresh was rejected: need to authenticate
  getAuthorizationURL();
  startLocalServer();
  return false; // Indicate that manual authorization is needed
}

// By running a local server to receive the authorization code, we can automate the process of getting the code from the user.
function startLocalServer() {
  const server = http.createServer(async (req, res) => {
    if (req.url && req.url.startsWith("/callback")) {
      const url = new URL(req.url, `http://127.0.0.1:8888`);
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

  server.listen(8888, "0.0.0.0", () => {
    logger.info(
      "Listening for Spotify authorization code on http://127.0.0.1:8888/callback"
    );
  });
}
