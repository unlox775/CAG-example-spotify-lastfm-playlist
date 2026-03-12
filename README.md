# Spotify Last.fm Explorer Playlist (CAG Example)

This is the project where I discovered the **Composite Agentic Gate (CAG)** pattern. It was the first one. I've used the pattern dozens of times since, but this was the aha moment -- and this is the working code.

**Read more about CAGs:** [The Compound Agentic Workflow -- How AI agents can solve messy real-world problems](https://medium.com/constant-total-amazement/the-compound-agentic-workflow-how-ai-agents-can-solve-messy-real-world-problems-25561e482876).

## The Story

I had a Spotify playlist I really liked. But playlists have a downside: they lock you into a narrow window of each artist. You hear the same handful of songs and never discover what else those artists have done. I wanted a way to break out of that.

The idea was simple. Take a playlist as a seed. Look at which artists are in it and how many songs each one has. Then go find the *next* most popular songs from each of those artists -- the ones just outside the playlist -- and build a new "Explorer" playlist from them, proportionally. If an artist has 8 songs in the seed, they get more slots in the Explorer. If they have 2, they get fewer. The Explorer becomes a way to extend your taste: listen to it, find songs you like, and pull them back into the original playlist. Your horizons expand naturally.

The catch is that Spotify doesn't have great data on what's *actually* popular across all platforms. Last.fm does -- it tracks global listening data and has reliable top-track lists for almost every artist. So the best approach is to use Last.fm's popularity data as the ranking source, then map those tracks back to Spotify for the actual playlist.

That's where the problem starts.

## The Problem: Two Worlds That Don't Talk

Spotify and Last.fm are completely separate data domains. There is no API that connects them. No shared IDs, no crossover endpoints, no way to say "give me the Last.fm data for this Spotify track" or vice versa. Neither platform has any particular motivation to build that bridge -- they are different products with different data models.

As a human, you can do it effortlessly. You can look up "Michael Jackson -- Thriller" on Spotify, then go to Last.fm and find the same song on a top tracks list, and you just *know* they're the same thing. You're bridging two unrelated databases with judgment. That's the fundamental gulf between humans and bots -- and it's exactly the kind of gap that composite agentic gates can bridge.

## Two Impossible Bridges

The goal requires crossing the domain gap **twice**, and each crossing is its own impossible task:

**Bridge 1: Spotify to Last.fm.** You have a Spotify playlist with artist names and Spotify IDs. Last.fm has no idea what a Spotify ID is. To find an artist's top tracks on Last.fm, you search by name -- and names don't always match. Spelling variations, special characters, "The" vs no "The." Fuzzy matching handles most of it, but some cases are genuinely ambiguous.

**Bridge 2: Last.fm back to Spotify.** Now you have a list of popular tracks from Last.fm -- song titles and artist names, nothing more. To add them to a Spotify playlist, you need Spotify track IDs. You search Spotify by name, but the same song might appear as a studio version, a live version, a remaster, a deluxe edition bonus track, or a completely different song with the same name by a different artist. Fuzzy matching handles most of it. But some cases need a human eye.

Each bridge is where deterministic code runs out of confidence. And that's exactly where the gates live.

## How the Gates Work

The pipeline runs deterministically as far as it can. When it hits a mapping it can't resolve with confidence, it **stops cold**:

1. It tells you exactly which track failed and why.
2. It shows you the top 5 closest Spotify candidates (name + ID).
3. It gives you the exact command to record the correct mapping.
4. It tells you the exact command to resume.

You (or an AI agent) pick the right candidate, record it, and rerun. The pipeline picks up where it left off, using the mapping you just provided. If another track fails further along, it stops again. Same loop. Repeat until the run completes.

That's the whole pattern: **deterministic code does the bulk work, gates catch the ambiguity, a human or agent resolves it with context, and the same command resumes the pipeline.** It's so simple and so effective that I've applied it to dozens of workflows since this one.

Detailed gate types and contracts: [docs/AGENTIC-FLOW.md](docs/AGENTIC-FLOW.md).

## Run with an AI Agent (Primary)

The point of this repo is to run the flow with an AI agent. You do one-time setup, then the agent runs the pipeline and handles gate output (fix mappings, rerun) for you.

**Agent runner:** This is configured for **Codex**. Have Codex installed and logged in so it can run in this repo. To use another agent (Cursor, Claude, etc.), the gate output and flow are the same -- port the runner; it should work with minimal changes.

**Codex setup (brief):** Install the Codex CLI, log in, and ensure it can execute in this directory. Once that's done, you're ready to run the flow with an agent.

**One-time setup (you):**

1. Install dependencies: `make install`
2. Create OAuth apps and get credentials: see [docs/OAUTH-SETUP.md](docs/OAUTH-SETUP.md).
3. Copy env: `cp .env.example .env` and fill in credentials from step 2.
4. Export env: `set -a && source .env && set +a`
5. Authenticate: `make auth-interactive`, `make auth-lastfm`, then `LASTFM_TOKEN="..." make auth-lastfm-token` with the callback token.
6. Sync playlists once: `make sync-spotify-playlists`

**Run the flow with your agent:** Point your agent at this repo and tell it to run the explorer playlist flow. The agent should:

1. Run: `make update-lastfm-explorer-playlist PLAYLIST_NAME="<your playlist name>"`
2. If the mapping gate triggers, read the gate output (failed tracks + top 5 Spotify candidates), run `make record-mapping ...` for each required mapping, then rerun the same `make update-lastfm-explorer-playlist` command.
3. Repeat until the run succeeds.

That's it. The agent does the flow; you get an up-to-date playlist without guessing wrong.

## Manual Workflow (If You Run Steps Yourself)

If you prefer to run steps by hand instead of with an agent:

1. Sync playlists: `make sync-spotify-playlists`
2. Create/update playlist: `make update-lastfm-explorer-playlist PLAYLIST_NAME="Dave's Folk"`
3. If the gate triggers: run `make record-mapping ...` for each failed track (use the candidate IDs from the gate output), then rerun step 2. Repeat until the run succeeds.

## About This Repo

This code was extracted from a private monorepo, sanitized, and AI-ported for the sake of showing a CAG example. It may be usable -- you're welcome to use it under the MIT license -- but it is not intended (yet) as a ready-to-use, production tool.

**Testing note.** Both Spotify and Last.fm require OAuth apps and active tokens. I did not run a full end-to-end test after setting up fresh OAuth credentials; the flow is trusted to work based on prior use, but verification after a clean OAuth setup has not been done. See [docs/OAUTH-SETUP.md](docs/OAUTH-SETUP.md) for OAuth setup steps.

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
- `docs/OAUTH-SETUP.md`: OAuth app creation and auth flow for Spotify and Last.fm.

## Extending the Example

- Tune strictness in `src/fuzzy-matcher.js` (Levenshtein thresholds).
- Change track distribution logic in `src/dynamic-distribution.js`.
- Add additional gates if you want separate stages for artist mapping and track mapping review.

## License

MIT. See [LICENSE](LICENSE).
