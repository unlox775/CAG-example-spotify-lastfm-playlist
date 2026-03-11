# Spotify Last.fm Explorer Playlist (CAG Example)

This repository is a standalone **Composite Agentic Gate (CAG)** example.

**What’s a CAG?** A Composite Agentic Gate is a checkpoint where normal code pauses and hands control to an AI agent (or human): the gate gives context, asks for a decision or fix, and tells you exactly how to re-enter the flow. That turns messy, judgment-heavy problems into repeatable pipelines instead of brittle one-shot scripts. **Read more:** [The Compound Agentic Workflow — How AI agents can solve messy real-world problems](https://medium.com/constant-total-amazement/the-compound-agentic-workflow-how-ai-agents-can-solve-messy-real-world-problems-25561e482876).

**About this repo.** This code was extracted from a private monorepo, sanitized, and AI-ported for the sake of showing a CAG example. It may be usable—you’re welcome to use it under the MIT license—but it is not intended (yet) as a ready-to-use, production tool.

This repo creates a Spotify "Explorer" playlist from one of your existing playlists by:

- finding your top artists,
- pulling each artist's top tracks from Last.fm,
- mapping those tracks to Spotify,
- and enforcing a hard stop when mapping is ambiguous.

That hard stop is the agentic gate.

## Why This Example Matters

Cross-vendor mapping (Last.fm -> Spotify) is inherently fuzzy. Deterministic code can do most of the work, but some cases require judgment.

This project combines both:

- deterministic pipeline stages for scale and repeatability,
- a strict agentic gate for ambiguity,
- explicit mutation instructions,
- exact rerun command for re-entry.

When the gate triggers, an agent (or you) fixes mappings in data (`mapping.db`) and reruns the same command. The flow continues.

## CAG Pattern in This Repo

Detailed flow: [docs/AGENTIC-FLOW.md](docs/AGENTIC-FLOW.md)

### Gate at a glance

- **Condition**: any track for the current artist fails exact-enough mapping.
- **Output**: fatal error + top 5 Spotify candidates per failed track.
- **Mutation**: run `make record-mapping ...` to store manual mappings.
- **Re-entry**: rerun `make update-lastfm-explorer-playlist PLAYLIST_NAME="..."`.

## Run with an AI Agent (Primary)

The point of this repo is to run the flow with an AI agent. You do one-time setup, then the agent runs the pipeline and handles gate output (fix mappings, rerun) for you.

**Agent runner:** This is configured for **Codex**. Have Codex installed and logged in so it can run in this repo. To use another agent (Cursor, Claude, etc.), the gate output and flow are the same—port the runner; it should work with minimal changes.

**Codex setup (brief):** Install the Codex CLI, log in, and ensure it can execute in this directory. Once that’s done, you’re ready to run the flow with an agent.

**One-time setup (you):**

1. Install dependencies: `make install`
2. Copy env: `cp .env.example .env` and fill in `SPOTIFY_CLIENT_ID`, `SPOTIFY_SECRET_ID`, `LASTFM_API_KEY`, `LASTFM_SHARED_SECRET`
3. Export env: `set -a && source .env && set +a`
4. Authenticate: `make auth-interactive`, `make auth-lastfm`, then `LASTFM_TOKEN="..." make auth-lastfm-token` with the callback token
5. Sync playlists once: `make sync-spotify-playlists`

**Run the flow with your agent:** Point your agent at this repo and tell it to run the explorer playlist flow. The agent should:

1. Run: `make update-lastfm-explorer-playlist PLAYLIST_NAME="<your playlist name>"`
2. If the mapping gate triggers, read the gate output (failed tracks + top 5 Spotify candidates), run `make record-mapping ...` for each required mapping, then rerun the same `make update-lastfm-explorer-playlist` command.
3. Repeat until the run succeeds.

That’s it. The agent does the flow; you get an up-to-date playlist without guessing wrong.

## Manual Workflow (If You Run Steps Yourself)

If you prefer to run steps by hand instead of with an agent:

1. Sync playlists: `make sync-spotify-playlists`
2. Create/update playlist: `make update-lastfm-explorer-playlist PLAYLIST_NAME="Dave's Folk"`
3. If the gate triggers: run `make record-mapping ...` for each failed track (use the candidate IDs from the gate output), then rerun step 2. Repeat until the run succeeds.

## Commands

- `make install`
- `make auth-interactive`
- `make auth-spotify AUTH_CODE=...`
- `make refresh-token`
- `make auth-lastfm`
- `make auth-lastfm-token LASTFM_TOKEN=...`
- `make sync-spotify-playlists`
- `make update-explorer-playlist PLAYLIST_NAME="..."`
- `make update-lastfm-explorer-playlist PLAYLIST_NAME="..."`
- `make map-lastfm-artist ARTIST_NAME="..."`
- `make map-lastfm-tracks ARTIST_NAME="..."`
- `make record-mapping ARTIST_NAME="..." LASTFM_TRACK="..." SPOTIFY_TRACK_ID="..."`
- `make mapping-status`
- `make add-artist-to-dill-n-doo ARTIST_NAME="..."`
- `make remove-artist-from-dill-n-doo ARTIST_NAME="..."`

## Environment Variables

Required:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_SECRET_ID`
- `LASTFM_API_KEY`
- `LASTFM_SHARED_SECRET` (or `LASTFM_SECRET`)

Optional:

- `SPOTIFY_REDIRECT_URI` (default `http://localhost:8888/callback`)
- `LASTFM_REDIRECT_URI` (default `SPOTIFY_REDIRECT_URI` or `http://localhost:8888/callback`)
- `REQUEST_LOG_GROUP` (defaults to generated timestamped group)
- `AUTH_STORE_PATH` (override local token store path)

## Project Structure

- `src/playlist-manager.js`: core pipeline + mapping gate.
- `src/fuzzy-matcher.js`: fuzzy ranking and exact-match thresholds.
- `src/mapping-db.js`: SQLite mappings.
- `src/mapping-tools.js`: manual mapping support commands.
- `src/auth.js`, `src/lastfm-auth.js`: token/session auth.
- `src/token-store.js`: local auth token persistence.
- `data/` (runtime): playlists cache, Last.fm cache, auth tokens, mappings.
- `docs/AGENTIC-FLOW.md`: gate contract and loop details.

## Extending the Example

- Tune strictness in `src/fuzzy-matcher.js` (Levenshtein thresholds).
- Change track distribution logic in `src/dynamic-distribution.js`.
- Add additional gates if you want separate stages for artist mapping and track mapping review.

## License

MIT. See [LICENSE](LICENSE).
