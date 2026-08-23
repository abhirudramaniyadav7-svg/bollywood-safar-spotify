# Bollywood Safar — Spotify Edition Setup Notes

## What changed
The player now streams full tracks directly from Spotify instead of local mp3
files — no more `music/` folder needed for playback.

- `script.js` handles Spotify login (OAuth PKCE flow) and the Web Playback SDK.
- Your Client ID (`075f2689804a461487f940850c03dde0`) is already plugged in.
- A "Connect to Spotify" button was added to the player card.

## Before it will work
1. **Spotify Premium is required** for anyone using this — the Web Playback
   SDK does not support free accounts.
2. **Add allowed users**: your app is in Development Mode (max 25 users).
   Go to your app in the Spotify Dashboard → Settings → add the Spotify
   account email of anyone who'll log in (including yourself).
3. **Run it at the exact redirect URI you registered**: `http://localhost:5500/`
   — in VS Code, open the folder and use the Live Server extension
   (it defaults to port 5500, matching what you registered). If it opens on
   a different port, either change the port in Live Server's settings or
   add the new URL as an extra Redirect URI in your Spotify app settings.

## How it works
1. Click "Connect to Spotify" → you're redirected to Spotify to log in and
   approve access.
2. You're redirected back, the app exchanges the login code for an access
   token, and initializes the Web Playback SDK.
3. Each song in the playlist is looked up on Spotify by title/artist to get
   its track URI.
4. Play/pause/next/prev/shuffle/progress bar all control Spotify playback
   through your account.

## Note
Playback happens through the logged-in user's own Spotify account/session —
this project does not store, host, or distribute any audio files itself.
