# Setup Guide

## 1) Install

```bash
make install
```

## 2) Configure Environment

Copy template and fill values:

```bash
cp .env.example .env
```

Load env vars into shell:

```bash
set -a
source .env
set +a
```

Required vars:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_SECRET_ID`
- `LASTFM_API_KEY`
- `LASTFM_SHARED_SECRET` (or `LASTFM_SECRET`)

Optional:

- `SPOTIFY_REDIRECT_URI`
- `LASTFM_REDIRECT_URI`
- `REQUEST_LOG_GROUP`

## 3) Authenticate

Spotify:

```bash
make auth-interactive
```

Last.fm:

```bash
make auth-lastfm
LASTFM_TOKEN="<token-from-callback>" make auth-lastfm-token
```

## 4) Sync Playlists

```bash
make sync-spotify-playlists
```

## 5) Run Explorer Flow

```bash
make update-lastfm-explorer-playlist PLAYLIST_NAME="Your Playlist"
```

If mapping gate triggers, add mapping(s) and rerun:

```bash
make record-mapping ARTIST_NAME="Artist" LASTFM_TRACK="Track" SPOTIFY_TRACK_ID="spotify_track_id" SPOTIFY_TRACK_NAME="Spotify Name" SPOTIFY_ARTIST_NAME="Spotify Artist"
make update-lastfm-explorer-playlist PLAYLIST_NAME="Your Playlist"
```

## Notes

- Tokens are stored locally in `data/auth/tokens.json`.
- Track/artist mappings are stored in SQLite: `data/mappings/mapping.db`.
- Logs are written to `logs/`.
