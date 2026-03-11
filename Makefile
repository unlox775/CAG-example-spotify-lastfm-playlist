# Spotify Library Management Makefile

.PHONY: help install check-spotify-env check-lastfm-env check-env auth-spotify auth-interactive refresh-token sync-spotify-playlists update-explorer-playlist update-lastfm-explorer-playlist record-mapping add-artist-to-dill-n-doo remove-artist-from-dill-n-doo auth-lastfm auth-lastfm-token map-lastfm-artist map-lastfm-tracks mapping-status clean

CLI_CMD=cd src && node cli.js

# Default target
help:
	@echo "Spotify Library Management"
	@echo ""
	@echo "Available targets:"
	@echo "  install                         - Install npm dependencies"
	@echo "  auth-spotify                    - Exchange authorization code for token"
	@echo "  auth-interactive                - Interactive Spotify authentication helper"
	@echo "  refresh-token                   - Refresh expired Spotify token"
	@echo "  sync-spotify-playlists          - Download all playlists from Spotify"
	@echo "  update-explorer-playlist        - Create explorer playlist (usage: make update-explorer-playlist PLAYLIST_NAME=name)"
	@echo "  update-lastfm-explorer-playlist - Create Last.fm explorer playlist (usage: make update-lastfm-explorer-playlist PLAYLIST_NAME=name)"
	@echo "  record-mapping                  - Record manual Last.fm to Spotify mapping"
	@echo "  add-artist-to-dill-n-doo        - Add artist to Dill 'n' Doo"
	@echo "  remove-artist-from-dill-n-doo   - Remove artist from Dill 'n' Doo"
	@echo "  auth-lastfm                     - Get Last.fm authentication URL"
	@echo "  auth-lastfm-token               - Exchange Last.fm token for session"
	@echo "  map-lastfm-artist               - Map Last.fm artist to Spotify"
	@echo "  map-lastfm-tracks               - Map Last.fm tracks for artist"
	@echo "  mapping-status                  - Show current Last.fm mapping status"
	@echo ""
	@echo "Required environment variables:"
	@echo "  SPOTIFY_CLIENT_ID"
	@echo "  SPOTIFY_SECRET_ID"
	@echo "  LASTFM_API_KEY"
	@echo "  LASTFM_SHARED_SECRET (or LASTFM_SECRET)"
	@echo ""
	@echo "Optional environment variables:"
	@echo "  SPOTIFY_REDIRECT_URI (default: http://localhost:8888/callback)"
	@echo "  LASTFM_REDIRECT_URI (default: SPOTIFY_REDIRECT_URI or http://localhost:8888/callback)"
	@echo "  REQUEST_LOG_GROUP"

check-spotify-env:
	@if [ -z "$$SPOTIFY_CLIENT_ID" ]; then \
		echo "Error: SPOTIFY_CLIENT_ID environment variable not set"; \
		exit 1; \
	fi
	@if [ -z "$$SPOTIFY_SECRET_ID" ]; then \
		echo "Error: SPOTIFY_SECRET_ID environment variable not set"; \
		exit 1; \
	fi

check-lastfm-env:
	@if [ -z "$$LASTFM_API_KEY" ]; then \
		echo "Error: LASTFM_API_KEY environment variable not set"; \
		exit 1; \
	fi
	@if [ -z "$$LASTFM_SHARED_SECRET" ] && [ -z "$$LASTFM_SECRET" ]; then \
		echo "Error: LASTFM_SHARED_SECRET (or LASTFM_SECRET) environment variable not set"; \
		exit 1; \
	fi

check-env: check-spotify-env check-lastfm-env

install:
	npm install --cache .npm-cache

auth-spotify: check-spotify-env
	@if [ -z "$$AUTH_CODE" ]; then \
		echo "Error: AUTH_CODE environment variable not set"; \
		echo "Usage: AUTH_CODE=your_code make auth-spotify"; \
		exit 1; \
	fi
	@echo "Exchanging authorization code for token..."
	@$(CLI_CMD) auth "$$AUTH_CODE"

auth-interactive: check-spotify-env
	@echo "Starting interactive Spotify authentication..."
	@cd src && node auth-helper.js

refresh-token: check-spotify-env
	@echo "Refreshing Spotify token..."
	@$(CLI_CMD) refresh-token

sync-spotify-playlists: check-spotify-env
	@echo "Syncing playlists from Spotify..."
	@$(CLI_CMD) sync-playlists

update-explorer-playlist: check-spotify-env
	@if [ -z "$$PLAYLIST_NAME" ]; then \
		echo "Error: PLAYLIST_NAME not specified"; \
		echo "Usage: make update-explorer-playlist PLAYLIST_NAME=your_playlist_name"; \
		exit 1; \
	fi
	@echo "Creating explorer playlist for: $$PLAYLIST_NAME"
	@$(CLI_CMD) create-explorer "$$PLAYLIST_NAME"

update-lastfm-explorer-playlist: check-env
	@if [ -z "$$PLAYLIST_NAME" ]; then \
		echo "Error: PLAYLIST_NAME not specified"; \
		echo "Usage: make update-lastfm-explorer-playlist PLAYLIST_NAME=your_playlist_name"; \
		exit 1; \
	fi
	@echo "Creating Last.fm-based explorer playlist for: $$PLAYLIST_NAME"
	@$(CLI_CMD) create-lastfm-explorer "$$PLAYLIST_NAME"

record-mapping:
	@if [ -z "$$ARTIST_NAME" ] || [ -z "$$LASTFM_TRACK" ] || [ -z "$$SPOTIFY_TRACK_ID" ]; then \
		echo "Error: Missing required parameters"; \
		echo "Usage: make record-mapping ARTIST_NAME=artist LASTFM_TRACK=track SPOTIFY_TRACK_ID=id [SPOTIFY_TRACK_NAME=name] [SPOTIFY_ARTIST_NAME=artist]"; \
		exit 1; \
	fi
	@echo "Recording manual mapping: $$LASTFM_TRACK -> $$SPOTIFY_TRACK_ID"
	@$(CLI_CMD) record-mapping "$$ARTIST_NAME" "$$LASTFM_TRACK" "$$SPOTIFY_TRACK_ID" "$$SPOTIFY_TRACK_NAME" "$$SPOTIFY_ARTIST_NAME"

add-artist-to-dill-n-doo: check-spotify-env
	@if [ -z "$$ARTIST_NAME" ]; then \
		echo "Error: ARTIST_NAME not specified"; \
		echo "Usage: make add-artist-to-dill-n-doo ARTIST_NAME=artist_name"; \
		exit 1; \
	fi
	@echo "Adding artist to Dill 'n' Doo: $$ARTIST_NAME"
	@$(CLI_CMD) add-artist "$$ARTIST_NAME"

remove-artist-from-dill-n-doo: check-spotify-env
	@if [ -z "$$ARTIST_NAME" ]; then \
		echo "Error: ARTIST_NAME not specified"; \
		echo "Usage: make remove-artist-from-dill-n-doo ARTIST_NAME=artist_name"; \
		exit 1; \
	fi
	@echo "Removing artist from Dill 'n' Doo: $$ARTIST_NAME"
	@$(CLI_CMD) remove-artist "$$ARTIST_NAME"

auth-lastfm: check-lastfm-env
	@echo "Getting Last.fm authentication URL..."
	@$(CLI_CMD) auth-lastfm

auth-lastfm-token: check-lastfm-env
	@if [ -z "$$LASTFM_TOKEN" ]; then \
		echo "Error: LASTFM_TOKEN environment variable not set"; \
		echo "Usage: LASTFM_TOKEN=your_token make auth-lastfm-token"; \
		exit 1; \
	fi
	@echo "Exchanging Last.fm token for session..."
	@$(CLI_CMD) auth-lastfm-token "$$LASTFM_TOKEN"

map-lastfm-artist: check-env
	@if [ -z "$$ARTIST_NAME" ]; then \
		echo "Error: ARTIST_NAME not specified"; \
		echo "Usage: make map-lastfm-artist ARTIST_NAME=artist_name"; \
		exit 1; \
	fi
	@echo "Mapping Last.fm artist to Spotify: $$ARTIST_NAME"
	@$(CLI_CMD) map-artist "$$ARTIST_NAME"

map-lastfm-tracks: check-env
	@if [ -z "$$ARTIST_NAME" ]; then \
		echo "Error: ARTIST_NAME not specified"; \
		echo "Usage: make map-lastfm-tracks ARTIST_NAME=artist_name"; \
		exit 1; \
	fi
	@echo "Mapping Last.fm tracks for artist: $$ARTIST_NAME"
	@$(CLI_CMD) map-tracks "$$ARTIST_NAME"

mapping-status:
	@echo "Showing Last.fm to Spotify mapping status..."
	@$(CLI_CMD) mapping-status

clean:
	@echo "Cleaning generated cache files..."
	@rm -rf data/spotify_playlists/*.json data/lastfm_cache/*.json
	@echo "Done. Preserved auth tokens and mappings in data/auth and data/mappings."
