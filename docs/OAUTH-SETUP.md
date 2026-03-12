# OAuth Setup: Spotify and Last.fm

Both Spotify and Last.fm require OAuth apps and active tokens. This guide walks through creating the apps and obtaining tokens.

## Overview

- **Spotify**: OAuth 2.0 with authorization code flow. You create an app in the Spotify Developer Dashboard, get a code via browser, exchange it for tokens.
- **Last.fm**: Similar flow—create an API application, authorize in browser, exchange a token for a session.

You need both to run the explorer playlist flow.

---

## Spotify

### 1. Create an application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Log in with your Spotify account.
3. Click **Create app**.
4. Fill in name and description (e.g., "CAG Explorer"), agree to the terms.
5. Click **Save**.

### 2. Get credentials

- **Client ID**: From the app’s overview page.
- **Client Secret**: Click **Settings** → reveal and copy the Client Secret.

### 3. Set redirect URI

1. In the app’s **Settings**.
2. Under **Redirect URIs**, add: `http://localhost:8888/callback`
3. Save.

### 4. Set environment variables

```bash
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_SECRET_ID="your_client_secret"
export SPOTIFY_REDIRECT_URI="http://localhost:8888/callback"   # optional, this is the default
```

### 5. Authenticate

1. Run `make auth-interactive`.
2. Open the printed URL in a browser and authorize the app.
3. You’ll be redirected to `http://localhost:8888/callback?code=...&state=xyz`.
4. Copy the `code` parameter from the URL.
5. Paste it when prompted.
6. The token is stored in `data/auth/tokens.json`.

If you have the code elsewhere:

```bash
make auth-spotify AUTH_CODE="your_authorization_code"
```

### 6. Refresh token (when expired)

```bash
make refresh-token
```

---

## Last.fm

### 1. Create an API application

1. Go to [Last.fm API account creation](https://www.last.fm/api/account/create).
2. Log in or create a Last.fm account.
3. Fill in the form:
   - **Application name**: e.g. "CAG Explorer"
   - **Callback URL**: `http://localhost:8888/callback` (must match what you use for Spotify if using the default)
   - **Application description**: optional
4. Submit.

### 2. Get credentials

After creation you’ll see:

- **API Key**
- **Shared Secret**

### 3. Set environment variables

```bash
export LASTFM_API_KEY="your_api_key"
export LASTFM_SHARED_SECRET="your_shared_secret"
export LASTFM_REDIRECT_URI="http://localhost:8888/callback"   # optional, default matches Spotify
```

`LASTFM_SECRET` can be used as an alias for `LASTFM_SHARED_SECRET`.

### 4. Authenticate

1. Run `make auth-lastfm` to print the authorization URL.
2. Open the URL in a browser and authorize the app.
3. You’ll be redirected to a URL containing a `token` parameter.
4. Copy that token and run:

```bash
LASTFM_TOKEN="your_token" make auth-lastfm-token
```

Session data is stored in `data/auth/tokens.json`.

---

## Shared notes

- **Redirect URI**: Both services use `http://localhost:8888/callback` by default. The callback URL in each app’s settings must match exactly.
- **Token storage**: All tokens live under `data/auth/` (by default `data/auth/tokens.json`). Add `data/` to `.gitignore` so credentials stay local.
- **Fresh setup**: If you’re testing on a new machine or new OAuth apps, run both auth flows before `make sync-spotify-playlists` or `make update-lastfm-explorer-playlist`.
