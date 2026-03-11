# Last.fm Setup

## Create Last.fm API Credentials

1. Open: https://www.last.fm/api/account/create
2. Create an API application.
3. Set callback URL to match your local config (default: `http://localhost:8888/callback`).

## Environment Variables

Set:

```bash
export LASTFM_API_KEY="your_lastfm_api_key"
export LASTFM_SHARED_SECRET="your_lastfm_shared_secret"
```

Compatibility alias also works:

```bash
export LASTFM_SECRET="your_lastfm_shared_secret"
```

## Authenticate Session

1. Generate auth URL:

```bash
make auth-lastfm
```

2. Open URL in browser, authorize app, copy `token` from callback URL.

3. Exchange token for session:

```bash
LASTFM_TOKEN="<token>" make auth-lastfm-token
```

Session data is stored in `data/auth/tokens.json`.

## Useful Last.fm Mapping Commands

```bash
make map-lastfm-artist ARTIST_NAME="Radiohead"
make map-lastfm-tracks ARTIST_NAME="Radiohead"
make mapping-status
```
