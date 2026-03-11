# Agent Instructions: Spotify Last.fm Explorer Playlist

This file describes how an agent should operate this repository as a standalone CAG example.

## Core Goal

Create or update `"<Playlist Name> Explorer"` from a source Spotify playlist using Last.fm track popularity plus Spotify mapping.

## Composite Agentic Gate

This project enforces one hard-stop gate:

- If any Last.fm -> Spotify track mapping is ambiguous, the run aborts.
- The output includes failed tracks and top Spotify candidates.
- The agent must record manual mappings.
- The agent reruns the same command to continue.

## Required Setup

1. Install dependencies:

```bash
make install
```

2. Load environment variables (`.env` or exported shell vars):

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_SECRET_ID`
- `LASTFM_API_KEY`
- `LASTFM_SHARED_SECRET` (or `LASTFM_SECRET`)

3. Optional logging group:

```bash
source set-log-group.sh spotify_library
```

4. Ensure playlist data is available:

```bash
make sync-spotify-playlists
```

## Primary Command

```bash
make update-lastfm-explorer-playlist PLAYLIST_NAME="<Playlist Name>"
```

## Gate Handling Procedure (Mandatory)

When you see output like:

- `❌ FATAL ERROR: X tracks failed to map for artist "..."`
- `🔧 MANUAL MAPPING REQUIRED`

Do the following immediately:

1. For each failed track, choose the best candidate from the listed top matches.
2. Prefer non-live versions when equivalent studio versions exist.
3. Record mapping(s):

```bash
make record-mapping ARTIST_NAME="Artist" LASTFM_TRACK="Track" SPOTIFY_TRACK_ID="spotify_id" SPOTIFY_TRACK_NAME="Spotify Name" SPOTIFY_ARTIST_NAME="Spotify Artist"
```

4. Rerun the main command:

```bash
make update-lastfm-explorer-playlist PLAYLIST_NAME="<Playlist Name>"
```

5. Repeat until no mapping failures remain.

## Expected Success Signals

- Explorer playlist exists in Spotify.
- Run logs indicate tracks were added.
- `make sync-spotify-playlists` places/update files in `data/spotify_playlists/`.

## Useful Commands

```bash
make auth-interactive
make auth-lastfm
LASTFM_TOKEN="..." make auth-lastfm-token
make sync-spotify-playlists
make update-lastfm-explorer-playlist PLAYLIST_NAME="..."
make record-mapping ARTIST_NAME="..." LASTFM_TRACK="..." SPOTIFY_TRACK_ID="..." SPOTIFY_TRACK_NAME="..." SPOTIFY_ARTIST_NAME="..."
make mapping-status
```

## Troubleshooting

- Missing env vars: run `make help` to see required variables.
- No local playlist cache: run `make sync-spotify-playlists` first.
- Repeated mapping failures: add all missing mappings for the failing artist before rerunning.
