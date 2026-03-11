# Agentic Flow: Spotify x Last.fm Mapping Gate

This project is a concrete **Composite Agentic Gate (CAG)** example.

The pipeline is mostly deterministic code, but it intentionally hard-stops at one agentic gate whenever track mapping is ambiguous.

## Flow Summary

1. Deterministic: load source playlist from `data/spotify_playlists/all_playlists_detailed.json`.
2. Deterministic: compute top artists and target distribution.
3. Deterministic: fetch top Last.fm tracks for each artist.
4. Deterministic + fuzzy matching: try to map each Last.fm track to Spotify.
5. **Agentic gate**: if any track for the current artist has no exact-enough match, abort and emit manual mapping instructions.
6. Human/agent mutation: record manual mapping in SQLite.
7. Re-entry: rerun the same command.
8. Deterministic: continue from the same flow, create/update playlist, sync local cache.

## Gate Contract

- **Gate condition**
  - Triggered when one or more tracks fail exact mapping during artist processing.
  - Implemented in `src/playlist-manager.js` inside `createLastFmExplorerPlaylist()`.
- **Gate output**
  - `❌ FATAL ERROR: X tracks failed to map for artist "..."`
  - Per failed track: top 5 Spotify candidates (name + ID).
  - `🔧 MANUAL MAPPING REQUIRED` with an example `make record-mapping` command.
- **Required mutation**
  - Data mutation (not code): write one or more Last.fm -> Spotify mappings into `data/mappings/mapping.db`.
  - Command: `make record-mapping ARTIST_NAME="..." LASTFM_TRACK="..." SPOTIFY_TRACK_ID="..." SPOTIFY_TRACK_NAME="..." SPOTIFY_ARTIST_NAME="..."`
- **Re-entry command**
  - `make update-lastfm-explorer-playlist PLAYLIST_NAME="Your Playlist"`

## Why This Is a CAG Example

Without the gate, the system would silently guess wrong matches or skip tracks. With the gate:

- deterministic stages do all high-volume work,
- ambiguous edge cases are escalated with context,
- a human/agent performs a precise mutation,
- the exact same command resumes the pipeline.

That loop creates a robust cross-vendor mapping workflow (Last.fm <-> Spotify) that would otherwise be brittle.

## Key Files

- `src/playlist-manager.js`: pipeline orchestration + gate enforcement.
- `src/fuzzy-matcher.js`: matching logic and candidate ranking.
- `src/mapping-db.js`: mapping persistence (SQLite).
- `src/mapping-tools.js`: manual mapping and diagnostics.
- `Makefile`: canonical rerun and mutation commands.

## Quick Recovery Example

If the run aborts with a failed mapping:

1. Pick the best non-live Spotify candidate from the printed top matches.
2. Record it:

```bash
make record-mapping \
  ARTIST_NAME="James Taylor" \
  LASTFM_TRACK="Fire and Rain" \
  SPOTIFY_TRACK_ID="4r9e0F5U2dXKV7ETNv3T7Q" \
  SPOTIFY_TRACK_NAME="Fire and Rain" \
  SPOTIFY_ARTIST_NAME="James Taylor"
```

3. Re-run:

```bash
make update-lastfm-explorer-playlist PLAYLIST_NAME="Dave's Folk"
```
