# Agentic Flow: Spotify x Last.fm Mapping Gate

This project is a concrete **Composite Agentic Gate (CAG)** example—one of the first such projects.

The pipeline is mostly deterministic code, but it uses several distinct gate types. Each gate either hard-stops (abort + manual intervention) or soft-skips (continue without the problematic item), depending on context.

## Flow Summary

1. Deterministic: load source playlist from `data/spotify_playlists/all_playlists_detailed.json`.
2. Deterministic: compute top artists and target distribution.
3. Deterministic: fetch top Last.fm tracks for each artist.
4. Deterministic + fuzzy matching: try to map each Last.fm track to Spotify.
5. **Agentic gate**: if any track for the current artist has no exact-enough match, abort and emit manual mapping instructions.
6. Human/agent mutation: record manual mapping in SQLite.
7. Re-entry: rerun the same command.
8. Deterministic: continue from the same flow, create/update playlist, sync local cache.

## Gate Types and Variants

The project uses several gate types. Each differs by *what* it guards, *when* it triggers, and *how* it behaves (hard stop vs soft skip).

### 1. Track Mapping Gate (Hard Stop)

**What it guards:** Last.fm track → Spotify track mapping.  
**Trigger:** One or more tracks for the current artist fail fuzzy matching (no exact-enough match).  
**Behavior:** Hard stop—abort the entire run, emit instructions, require manual mapping.  
**Context:** Main pipeline (`createLastFmExplorerPlaylist`) and standalone `map-tracks`.

- **Gate output**
  - `❌ FATAL ERROR: X tracks failed to map for artist "..."`
  - Per failed track: top 5 Spotify candidates (name + ID).
  - `🔧 MANUAL MAPPING REQUIRED` with an example `make record-mapping` command.
- **Required mutation**
  - Data mutation: write Last.fm → Spotify mappings into `data/mappings/mapping.db`.
  - Command: `make record-mapping ARTIST_NAME="..." LASTFM_TRACK="..." SPOTIFY_TRACK_ID="..." SPOTIFY_TRACK_NAME="..." SPOTIFY_ARTIST_NAME="..."`
- **Re-entry:** `make update-lastfm-explorer-playlist PLAYLIST_NAME="Your Playlist"` (or rerun `map-tracks`).
- **Location:** `src/playlist-manager.js` (createLastFmExplorerPlaylist), `src/mapping-tools.js` (mapArtistTracks).

### 2. Artist Mapping Gate (Context-Dependent)

**What it guards:** Last.fm artist → Spotify artist mapping.  
**Trigger:** Artist not in DB; Last.fm search finds no artists, or fuzzy matcher finds no exact-enough Spotify match.  
**Behavior:** Depends on context.

| Context        | Behavior   | Notes                                                 |
|----------------|------------|-------------------------------------------------------|
| Main pipeline  | **Soft skip** | Skip artist, continue with next. No abort.         |
| Standalone `map-artist` | **Hard stop** | Abort, emit top 5 candidates, require manual fix. |

- **Location:** `src/playlist-manager.js` (createLastFmExplorerPlaylist, ~lines 313–355), `src/mapping-tools.js` (mapArtist).

### 3. Curation Preservation Gate (Guard)

**What it guards:** User’s manual curation. Prevents overwriting hand-picked tracks.  
**Trigger:** Adding an artist to Dill 'n' Doo when that artist is already in the playlist.  
**Behavior:** Hard stop—abort with an explicit error message.  
**Mutation:** None. This is a guard; the correct “fix” is to not add the artist.  
**Location:** `src/playlist-manager.js` (addArtistToDillNDoo, ~lines 862–869).

### 4. Fuzzy Matcher as Gate Layer

The fuzzy matcher (`src/fuzzy-matcher.js`) defines *when* a mapping is ambiguous:

- **Artist:** Levenshtein distance ≤ 1 → exact enough; otherwise `NO_EXACT_MATCH`.
- **Track:** Combined track+artist Levenshtein distance ≤ 2 → exact enough; otherwise `NO_EXACT_MATCH`. Non-live tracks are preferred.

The matcher throws `NO_EXACT_MATCH` with `topMatches`; the calling code decides whether to hard-stop or soft-skip.

## Primary Gate Contract (Track Mapping)

For the main CAG loop, the track mapping gate is the one that enforces the canonical “abort → mutate → rerun” flow:

- **Gate condition:** One or more tracks fail exact mapping during artist processing.
- **Gate output:** As in §1 above.
- **Required mutation:** `make record-mapping` as shown.
- **Re-entry command:** `make update-lastfm-explorer-playlist PLAYLIST_NAME="Your Playlist"`.

## Why This Is a CAG Example

Without the gates, the system would silently guess wrong matches or skip tracks. With the gates:

- deterministic stages do all high-volume work,
- ambiguous edge cases are escalated with context (top candidates, explicit instructions),
- a human/agent performs a precise mutation (data only, not code),
- the exact same command resumes the pipeline.

The **track mapping gate** (§1) is the main CAG loop. The **artist mapping gate** (§2) shows how the same underlying ambiguity can be handled as hard-stop (standalone tools) or soft-skip (batch pipeline). The **curation preservation gate** (§3) illustrates a different gate type: a guard that blocks destructive actions rather than resolving ambiguity.

## Key Files

- `src/playlist-manager.js`: pipeline orchestration; track gate (§1), artist soft-skip (§2), curation guard (§3).
- `src/fuzzy-matcher.js`: ambiguity thresholds and `NO_EXACT_MATCH` emission (§4).
- `src/mapping-db.js`: mapping persistence (SQLite).
- `src/mapping-tools.js`: standalone map-artist/map-tracks with hard-stop gates (§1, §2).
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
