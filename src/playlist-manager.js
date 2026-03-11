const fs = require('fs');
const path = require('path');
const SpotifyAPI = require('./spotify-api');
const LastFmAPI = require('./lastfm-api');
const MappingDB = require('./mapping-db');
const FuzzyMatcher = require('./fuzzy-matcher');
const Logger = require('./logger');
const DynamicDistribution = require('./dynamic-distribution');

class PlaylistManager {
    constructor() {
        this.api = new SpotifyAPI();
        this.lastfm = new LastFmAPI();
        this.db = new MappingDB();
        this.matcher = new FuzzyMatcher();
        this.logger = new Logger();
        this.dataDir = path.join(__dirname, '..', 'data');
        this.playlistsDir = path.join(this.dataDir, 'spotify_playlists');
        this.mappingsDir = path.join(this.dataDir, 'mappings');
        
        // Ensure directories exist
        [this.playlistsDir, this.mappingsDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // Convert playlist name to snake_case for filename
    toSnakeCase(str) {
        return str
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/-+/g, '_') // Replace hyphens with underscores
            .replace(/_+/g, '_') // Replace multiple underscores with single underscore
            .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    }

    // Generate filename for playlist
    getPlaylistFilename(playlist) {
        const snakeName = this.toSnakeCase(playlist.name);
        return `playlist_${snakeName}_${playlist.id}.json`;
    }

    // Find existing playlist file by ID
    findPlaylistFile(playlistId) {
        const files = fs.readdirSync(this.playlistsDir);
        const playlistFile = files.find(file => 
            file.endsWith(`_${playlistId}.json`)
        );
        return playlistFile ? path.join(this.playlistsDir, playlistFile) : null;
    }

    // Rename playlist file if name changed
    renamePlaylistFile(oldPath, newFilename) {
        if (oldPath && fs.existsSync(oldPath)) {
            const newPath = path.join(this.playlistsDir, newFilename);
            if (oldPath !== newPath) {
                fs.renameSync(oldPath, newPath);
                console.log(`Renamed playlist file: ${path.basename(oldPath)} -> ${newFilename}`);
            }
        }
    }

    async syncPlaylists() {
        console.log('Syncing playlists from Spotify...');
        
        try {
            // Get current user info
            const user = await this.api.getCurrentUser();
            console.log(`Syncing playlists for user: ${user.display_name}`);
            
            // Get all playlists
            const playlists = await this.api.getUserPlaylists();
            console.log(`Found ${playlists.length} playlists`);
            
            // Clean up old playlist files that no longer exist
            const existingFiles = fs.readdirSync(this.playlistsDir);
            const currentPlaylistIds = new Set(playlists.map(p => p.id));
            
            for (const file of existingFiles) {
                if (file.endsWith('.json')) {
                    // Extract playlist ID from filename (format: name_id.json)
                    const playlistId = file.match(/_([^_]+)\.json$/)?.[1];
                    if (playlistId && !currentPlaylistIds.has(playlistId)) {
                        const filePath = path.join(this.playlistsDir, file);
                        fs.unlinkSync(filePath);
                        console.log(`Removed old playlist file: ${file}`);
                    }
                }
            }
            
            // Save playlists metadata
            const playlistsFile = path.join(this.playlistsDir, 'playlists.json');
            fs.writeFileSync(playlistsFile, JSON.stringify(playlists, null, 2));
            console.log(`Saved playlists metadata to ${playlistsFile}`);
            
            // Get detailed info and tracks for each playlist
            const detailedPlaylists = [];
            for (const playlist of playlists) {
                console.log(`Processing playlist: ${playlist.name}`);
                
                // Get playlist details
                const details = await this.api.getPlaylistDetails(playlist.id);
                
                // Get playlist tracks
                const tracks = await this.api.getPlaylistTracks(playlist.id);
                
                // Filter the details and remove the tracks field since we'll add our own
                const filteredDetails = this.api.filterSpotifyData(details);
                delete filteredDetails.tracks;
                
                const detailedPlaylist = {
                    ...filteredDetails,
                    tracks: tracks.map(trackData => this.api.filterSpotifyData(trackData))
                };
                
                detailedPlaylists.push(detailedPlaylist);
                
                // Generate filename with snake-cased name
                const newFilename = this.getPlaylistFilename(detailedPlaylist);
                const oldFilePath = this.findPlaylistFile(playlist.id);
                
                // Rename file if playlist name changed
                this.renamePlaylistFile(oldFilePath, newFilename);
                
                // Save individual playlist file
                const playlistFile = path.join(this.playlistsDir, newFilename);
                fs.writeFileSync(playlistFile, JSON.stringify(detailedPlaylist, null, 2));
            }
            
            // Save all detailed playlists (don't filter this file as it needs tracks)
            const allPlaylistsFile = path.join(this.playlistsDir, 'all_playlists_detailed.json');
            fs.writeFileSync(allPlaylistsFile, JSON.stringify(detailedPlaylists, null, 2));
            console.log(`Saved detailed playlists to ${allPlaylistsFile}`);
            
            // Generate markdown stats report for playlists
            this.generatePlaylistStatsMarkdown(detailedPlaylists);

            console.log('Playlist sync completed successfully!');
            return detailedPlaylists;
            
        } catch (error) {
            console.error('Error syncing playlists:', error.message);
            throw error;
        }
    }

    escapeHtml(str) {
        if (typeof str !== 'string') {
            return str;
        }
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    generatePlaylistStatsMarkdown(playlists) {
        if (!Array.isArray(playlists)) {
            return;
        }

        const reportLines = [];
        const timestamp = new Date().toISOString();
        reportLines.push('# Spotify Playlist Artist Stats');
        reportLines.push('');
        reportLines.push(`Generated: ${timestamp}`);
        reportLines.push('');

        const sortedPlaylists = [...playlists].sort((a, b) => {
            const nameA = (a?.name || '').toLowerCase();
            const nameB = (b?.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        for (const playlist of sortedPlaylists) {
            const playlistName = playlist?.name || 'Untitled Playlist';
            reportLines.push(`## ${playlistName}`);
            reportLines.push('');

            const artistCounts = new Map();
            const tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];

            for (const trackWrapper of tracks) {
                const track = trackWrapper?.track || trackWrapper;
                const artists = Array.isArray(track?.artists) ? track.artists : [];

                if (artists.length === 0) {
                    continue;
                }

                for (const artist of artists) {
                    if (!artist?.name) {
                        continue;
                    }
                    const currentCount = artistCounts.get(artist.name) || 0;
                    artistCounts.set(artist.name, currentCount + 1);
                }
            }

            if (artistCounts.size === 0) {
                reportLines.push('_No tracks available._');
                reportLines.push('');
                continue;
            }

            const sortedCounts = Array.from(artistCounts.entries()).sort((a, b) => {
                if (b[1] !== a[1]) {
                    return b[1] - a[1];
                }
                return a[0].localeCompare(b[0]);
            });

            reportLines.push('<table>');

            const columns = 4;
            for (let i = 0; i < sortedCounts.length; i += columns) {
                const cells = [];
                for (let col = 0; col < columns; col++) {
                    const entry = sortedCounts[i + col];
                    if (entry) {
                        const [artistName, count] = entry;
                        cells.push(`<td>${this.escapeHtml(`${artistName}: ${count}`)}</td>`);
                    } else {
                        cells.push('<td>&nbsp;</td>');
                    }
                }
                reportLines.push(`<tr>${cells.join('')}</tr>`);
            }

            reportLines.push('</table>');
            reportLines.push('');
        }

        const outputPath = path.join(this.playlistsDir, 'playlist_artist_stats.md');
        fs.writeFileSync(outputPath, reportLines.join('\n'));
        console.log(`Saved playlist artist stats to ${outputPath}`);
    }

    async createLastFmExplorerPlaylist(sourcePlaylistName) {
        this.logger.info(`Starting Last.fm-based explorer playlist creation for: ${sourcePlaylistName}`, null, 'CREATE_EXPLORER');
        
        try {
            // Initialize database
            await this.db.init();
            
            // Load all playlists
            const playlistsFile = path.join(this.playlistsDir, 'all_playlists_detailed.json');
            if (!fs.existsSync(playlistsFile)) {
                throw new Error('No playlists found. Please run sync first.');
            }
            
            const allPlaylists = JSON.parse(fs.readFileSync(playlistsFile, 'utf8'));
            
            // Find source playlist
            const sourcePlaylist = allPlaylists.find(p => 
                p.name.toLowerCase() === sourcePlaylistName.toLowerCase()
            );
            
            if (!sourcePlaylist) {
                throw new Error(`Playlist "${sourcePlaylistName}" not found`);
            }
            
            
            this.logger.info(`Found source playlist: ${sourcePlaylist.name} with ${sourcePlaylist.tracks?.length || 0} tracks`, null, 'CREATE_EXPLORER');
            
            // Analyze tracks to find top artists
            const artistCounts = {};
            
            // Count artists in source playlist
            this.logger.info(`Processing ${sourcePlaylist.tracks.length} tracks from source playlist`, null, 'ANALYZE_ARTISTS');
            for (const trackData of sourcePlaylist.tracks) {
                if (trackData.track && trackData.track.artists) {
                    for (const artist of trackData.track.artists) {
                        artistCounts[artist.id] = {
                            name: artist.name,
                            count: (artistCounts[artist.id]?.count || 0) + 1
                        };
                    }
                }
            }
            
            // Sort artists by frequency
            const topArtists = Object.entries(artistCounts)
                .sort(([,a], [,b]) => b.count - a.count);
            
            this.logger.info(`Found ${topArtists.length} artists in source playlist:`, null, 'ANALYZE_ARTISTS');
            topArtists.forEach(([id, data], index) => {
                this.logger.info(`  ${index + 1}. ${data.name}: ${data.count} songs`, null, 'ANALYZE_ARTISTS');
            });
            
            // Calculate dynamic distribution
            const distributionResult = DynamicDistribution.calculateDistribution(artistCounts);
            this.logger.info(DynamicDistribution.getDistributionSummary(distributionResult), null, 'DYNAMIC_DISTRIBUTION');
            
            // Get Last.fm top tracks for each artist and map to Spotify
            const explorerTracks = [];
            this.lastfmTrackCounts = {}; // Track Last.fm counts for summary
            
            for (const [artistId, artistData] of topArtists) {
                const targetSongs = distributionResult.distribution[artistId] || 0;
                if (targetSongs === 0) {
                    this.logger.info(`Skipping artist: ${artistData.name} (not selected for distribution)`, null, 'PROCESS_ARTIST');
                    continue;
                }
                
                this.logger.info(`Processing artist: ${artistData.name} (${artistData.count} songs in source → ${targetSongs} target)`, null, 'PROCESS_ARTIST');
                
                try {
                    // Check if artist is already mapped
                    let artistMapping = await this.db.getArtistMapping(artistData.name);
                    
                    if (!artistMapping) {
                        this.logger.debug(`Artist not mapped, searching Last.fm...`);
                        // Search Last.fm for artist
                        const lastfmSearch = await this.lastfm.searchArtist(artistData.name);
                        
                        if (lastfmSearch && lastfmSearch.results && lastfmSearch.results.artistmatches && lastfmSearch.results.artistmatches.artist) {
                            const lastfmArtists = lastfmSearch.results.artistmatches.artist;
                            if (Array.isArray(lastfmArtists) && lastfmArtists.length > 0) {
                                const lastfmArtist = lastfmArtists[0];
                                
                                // Find best Spotify match
                                const spotifyMatch = await this.matcher.searchArtist(lastfmArtist.name);
                                
                                if (spotifyMatch) {
                                    this.logger.info(`Found Spotify match: ${spotifyMatch.name} (${(spotifyMatch.similarity_score * 100).toFixed(1)}%)`);
                                    
                                    // Save mapping
                                    await this.db.saveArtistMapping(
                                        lastfmArtist.name,
                                        spotifyMatch.id,
                                        spotifyMatch.name,
                                        spotifyMatch.similarity_score
                                    );
                                    
                                    artistMapping = {
                                        lastfm_artist_name: lastfmArtist.name,
                                        spotify_artist_id: spotifyMatch.id,
                                        spotify_artist_name: spotifyMatch.name
                                    };
                                } else {
                                    this.logger.warn(`No suitable Spotify match found for "${lastfmArtist.name}"`);
                                    continue;
                                }
                            } else {
                                this.logger.warn(`No Last.fm artists found for "${artistData.name}"`);
                                continue;
                            }
                        } else {
                            this.logger.warn(`No Last.fm search results for "${artistData.name}"`);
                            continue;
                        }
                    } else {
                        this.logger.info(`Using existing mapping: ${artistMapping.spotify_artist_name}`, null, 'PROCESS_ARTIST');
                    }
                    
                    // Get top tracks from Last.fm
                    this.logger.info(`Getting top 100 tracks from Last.fm for ${artistMapping.lastfm_artist_name}...`, null, 'PROCESS_ARTIST');
                    const lastfmTracks = await this.lastfm.getArtistTopTracks(artistMapping.lastfm_artist_name, 100);
                    
                    if (!lastfmTracks || !lastfmTracks.toptracks) {
                        this.logger.warn(`No Last.fm tracks found for "${artistMapping.lastfm_artist_name}"`);
                        this.lastfmTrackCounts[artistData.name] = 0;
                        continue;
                    }
                    
                    // Handle both cached data (array) and raw API data (object with track property)
                    let tracks;
                    if (Array.isArray(lastfmTracks.toptracks)) {
                        // Cached data format
                        tracks = lastfmTracks.toptracks;
                    } else if (lastfmTracks.toptracks.track) {
                        // Raw API data format
                        tracks = Array.isArray(lastfmTracks.toptracks.track) 
                            ? lastfmTracks.toptracks.track 
                            : [lastfmTracks.toptracks.track];
                    } else {
                        this.logger.warn(`No Last.fm tracks found for "${artistMapping.lastfm_artist_name}"`);
                        continue;
                    }
                    
                    // Store the count for summary
                    this.lastfmTrackCounts[artistData.name] = tracks.length;
                    this.logger.info(`Found ${tracks.length} tracks from Last.fm`, null, 'PROCESS_ARTIST');
                    
                    // Filter out tracks already in playlists
                    const allTracks = new Set();
                    for (const playlist of allPlaylists) {
                        for (const trackData of playlist.tracks) {
                            if (trackData.track && trackData.track.id) {
                                allTracks.add(trackData.track.id);
                            }
                        }
                    }
                    
                    // Process tracks one by one until we get target number of new ones
                    let addedTracks = 0;
                    let processedTracks = 0;
                    let failedMappings = [];
                    
                    this.logger.info(`Searching for ${targetSongs} new tracks from ${artistMapping.spotify_artist_name}...`, null, 'MAP_TRACKS');
                    
                    for (const lastfmTrack of tracks) {
                        if (addedTracks >= targetSongs) break;
                        if (processedTracks >= 50) break; // Safety limit
                        
                        try {
                            const spotifyMatch = await this.matcher.searchTrack(lastfmTrack.name, artistMapping.lastfm_artist_name);
                            
                            if (spotifyMatch && !allTracks.has(spotifyMatch.id)) {
                                explorerTracks.push({
                                    ...spotifyMatch,
                                    artist_name: artistMapping.spotify_artist_name,
                                    source_playlist: sourcePlaylistName,
                                    lastfm_playcount: lastfmTrack.playcount || 0
                                });
                                addedTracks++;
                                this.logger.info(`  ✓ Added: ${spotifyMatch.name}`, null, 'MAP_TRACKS');
                            } else if (spotifyMatch) {
                                this.logger.info(`  - Skipped (already in playlist): ${spotifyMatch.name}`, null, 'MAP_TRACKS');
                            }
                        } catch (error) {
                            if (error.code === 'NO_EXACT_MATCH') {
                                // Collect failed mapping with detailed error info
                                failedMappings.push({
                                    lastfm_track: lastfmTrack,
                                    error: error,
                                    topMatches: error.topMatches || []
                                });
                                
                                this.logger.warn(`Mapping failed: ${lastfmTrack.name} by ${artistMapping.lastfm_artist_name} - No exact match found`, null, 'FUZZY_MATCH');
                            } else {
                                // Other errors
                                failedMappings.push({
                                    lastfm_track: lastfmTrack,
                                    error: error,
                                    topMatches: []
                                });
                                
                                this.logger.warn(`Mapping failed: ${lastfmTrack.name} by ${artistMapping.lastfm_artist_name} - ${error.message}`, null, 'FUZZY_MATCH');
                            }
                        }
                        
                        processedTracks++;
                    }
                    
                    // FATAL: If ANY tracks failed to map, stop immediately and provide detailed error info
                    if (failedMappings.length > 0) {
                        this.logger.error(`❌ FATAL ERROR: ${failedMappings.length} tracks failed to map for artist "${artistMapping.spotify_artist_name}"`, null, 'MAP_TRACKS');
                        
                        // Display each failed track with its top matches
                        for (const failed of failedMappings) {
                            if (failed.topMatches && failed.topMatches.length > 0) {
                                // Remove duplicates and limit to 5
                                const uniqueMatches = [];
                                const seenNames = new Set();
                                for (const match of failed.topMatches) {
                                    if (!seenNames.has(match.name)) {
                                        uniqueMatches.push(match);
                                        seenNames.add(match.name);
                                        if (uniqueMatches.length >= 5) break;
                                    }
                                }
                                
                                this.logger.error(`${failed.lastfm_track.name}, 5 closest matches:`, null, 'MAP_TRACKS');
                                uniqueMatches.forEach((match) => {
                                    this.logger.error(`  ${match.name}, ${match.id}`, null, 'MAP_TRACKS');
                                });
                            }
                        }
                        
                        // Provide manual mapping instructions
                        this.logger.error(`🔧 MANUAL MAPPING REQUIRED:`, null, 'MAP_TRACKS');
                        this.logger.error(`Choose the best Spotify match for each track above. Prefer non-live versions when available.`, null, 'MAP_TRACKS');
                        this.logger.error(`Example command: make record-mapping ARTIST_NAME="${artistMapping.lastfm_artist_name}" LASTFM_TRACK="..." SPOTIFY_TRACK_ID="..." SPOTIFY_TRACK_NAME="..." SPOTIFY_ARTIST_NAME="..."`, null, 'MAP_TRACKS');
                        
                        throw new Error(`FATAL: ${failedMappings.length} tracks failed to map for artist "${artistMapping.spotify_artist_name}". Manual mapping required.`);
                    }
                    
                    this.logger.info(`✓ Successfully added ${addedTracks} tracks from ${artistMapping.spotify_artist_name}`, null, 'MAP_TRACKS');
                    
                } catch (error) {
                    this.logger.error(`Error processing artist ${artistData.name}: ${error.message}`);
                    // Re-throw the error to stop the entire process
                    throw error;
                }
            }
            
            // Sort by Last.fm playcount (descending) and then by popularity
            explorerTracks.sort((a, b) => {
                const playcountA = a.lastfm_playcount || 0;
                const playcountB = b.lastfm_playcount || 0;
                if (playcountA !== playcountB) {
                    return playcountB - playcountA;
                }
                return (b.popularity || 0) - (a.popularity || 0);
            });
            
            // Remove duplicates based on track ID before taking top 50
            const uniqueTracks = [];
            const seenTrackIds = new Set();
            
            for (const track of explorerTracks) {
                if (!seenTrackIds.has(track.id)) {
                    seenTrackIds.add(track.id);
                    uniqueTracks.push(track);
                }
            }
            
            this.logger.info(`Removed ${explorerTracks.length - uniqueTracks.length} duplicate tracks`, null, 'CLEANUP_DUPLICATES');
            
            // Take tracks up to the target total (should be around 50)
            const targetTotal = Object.values(distributionResult.distribution).reduce((sum, count) => sum + count, 0);
            const selectedTracks = uniqueTracks.slice(0, Math.min(50, targetTotal));
            
            this.logger.info(`Found ${selectedTracks.length} explorer tracks from Last.fm data`, {
                total_tracks: selectedTracks.length,
                tracks_by_artist: selectedTracks.reduce((acc, track) => {
                    const artist = track.artist_name;
                    acc[artist] = (acc[artist] || 0) + 1;
                    return acc;
                }, {})
            });
            
            // Save explorer playlist locally
            const explorerPlaylist = {
                name: `${sourcePlaylistName} Explorer`,
                description: `Explorer playlist generated from ${sourcePlaylistName} using Last.fm top tracks`,
                source_playlist: sourcePlaylistName,
                created_at: new Date().toISOString(),
                tracks: selectedTracks
            };
            
            // No need to save JSON file - we're creating actual Spotify playlists
            this.logger.info(`Created Last.fm explorer playlist: ${explorerPlaylist.name}`);

            // Check for existing explorer playlist to update - fetch live data from Spotify
            const livePlaylists = await this.api.getUserPlaylists();
            const existingPlaylist = livePlaylists.find(p => 
                p.name === explorerPlaylist.name || 
                p.name === `${sourcePlaylistName} Explorer (Last.fm)`
            );
            
            let spotifyPlaylist;
            let existingTrackIds = new Set();
            
        if (existingPlaylist) {
            this.logger.info(`Found existing explorer playlist: ${existingPlaylist.name} (${existingPlaylist.id})`, null, 'UPDATE_PLAYLIST');
            
            // Get existing tracks to check for duplicates
            try {
                const existingTracks = await this.api.getPlaylistTracks(existingPlaylist.id);
                existingTrackIds = new Set(existingTracks.map(trackData => trackData.track?.id).filter(Boolean));
                this.logger.info(`Found ${existingTrackIds.size} existing tracks in playlist`, null, 'UPDATE_PLAYLIST');
            } catch (error) {
                this.logger.warn(`Failed to get existing tracks: ${error.message}`, null, 'UPDATE_PLAYLIST');
            }
            
            // Filter out tracks that are already in the playlist
            const tracksToAdd = selectedTracks.filter(track => !existingTrackIds.has(track.id));
            this.logger.info(`After removing duplicates: ${tracksToAdd.length} new tracks to add (${selectedTracks.length - tracksToAdd.length} duplicates removed)`, null, 'UPDATE_PLAYLIST');
            
            // Clear existing tracks only if we have new tracks to add
            if (tracksToAdd.length > 0) {
                this.logger.info(`Clearing existing tracks from playlist...`, null, 'UPDATE_PLAYLIST');
                try {
                    await this.api.clearPlaylistTracks(existingPlaylist.id);
                    this.logger.info(`Successfully cleared existing tracks from playlist`, null, 'UPDATE_PLAYLIST');
                } catch (error) {
                    this.logger.warn(`Failed to clear playlist tracks: ${error.message}`, null, 'UPDATE_PLAYLIST');
                }
            } else {
                this.logger.info(`No new tracks to add - playlist is up to date`, null, 'UPDATE_PLAYLIST');
            }
            
            spotifyPlaylist = existingPlaylist;
        } else {
            // Create new playlist
            this.logger.info(`No existing explorer playlist found. Creating new Spotify playlist: ${explorerPlaylist.name}`, null, 'CREATE_PLAYLIST');
            const user = await this.api.getCurrentUser();
            this.logger.info(`Creating playlist for user: ${user.id}`, null, 'CREATE_PLAYLIST');
            
            spotifyPlaylist = await this.api.createPlaylist(
                user.id,
                explorerPlaylist.name,
                explorerPlaylist.description
            );
            
            this.logger.info(`Spotify API response - Created playlist:`, {
                id: spotifyPlaylist.id,
                name: spotifyPlaylist.name,
                description: spotifyPlaylist.description,
                public: spotifyPlaylist.public,
                collaborative: spotifyPlaylist.collaborative,
                owner: spotifyPlaylist.owner?.display_name || 'Unknown'
            }, 'CREATE_PLAYLIST');
        }
            
            // Add tracks to Spotify playlist
            const tracksToAdd = existingPlaylist ? selectedTracks.filter(track => !existingTrackIds.has(track.id)) : selectedTracks;
            const trackUris = tracksToAdd.map(track => track.uri);
            
            if (trackUris.length > 0) {
                this.logger.info(`Adding ${trackUris.length} tracks to Spotify playlist...`, null, 'CREATE_EXPLORER');
                try {
                    const addResponse = await this.api.addTracksToPlaylist(spotifyPlaylist.id, trackUris);
                    this.logger.info(`Spotify API response - Added tracks:`, {
                        snapshot_id: addResponse.snapshot_id,
                        tracks_added: trackUris.length,
                        playlist_id: spotifyPlaylist.id
                    }, 'CREATE_EXPLORER');
                } catch (error) {
                    this.logger.error(`Failed to add tracks to playlist: ${error.message}`, null, 'CREATE_EXPLORER');
                    throw error;
                }
                
                const playlistUrl = spotifyPlaylist.external_urls?.spotify || `https://open.spotify.com/playlist/${spotifyPlaylist.id}`;
                this.logger.info(`Successfully added ${trackUris.length} tracks to Spotify playlist: ${playlistUrl}`, null, 'CREATE_EXPLORER');
            } else {
                this.logger.info(`No new tracks to add - playlist is up to date`, null, 'CREATE_EXPLORER');
            }
            
            // Enhanced summary output - clean format
            this.logger.info('=== EXPLORER PLAYLIST SUMMARY ===', null, 'CREATE_EXPLORER');
            const playlistUrl = spotifyPlaylist.external_urls?.spotify || `https://open.spotify.com/playlist/${spotifyPlaylist.id}`;
            this.logger.info(`Created playlist: ${explorerPlaylist.name} (${selectedTracks.length} tracks) - ${playlistUrl}`, null, 'CREATE_EXPLORER');
            
            // Artists summary - one line per artist with dynamic distribution
            this.logger.info('Artists from source playlist (with dynamic distribution):', null, 'CREATE_EXPLORER');
            topArtists.forEach(([id, data]) => {
                const tracksAdded = selectedTracks.filter(t => t.artists[0].id === id).length;
                const targetSongs = distributionResult.distribution[id] || 0;
                // Get Last.fm track count for this artist
                const lastfmCount = this.lastfmTrackCounts[data.name] || 'unknown';
                this.logger.info(`  ${data.name}: ${data.count} songs in source, ${lastfmCount} found in Last.fm, ${tracksAdded}/${targetSongs} added to Explorer`, null, 'CREATE_EXPLORER');
            });
            
            // Group tracks by artist for detailed output
            const tracksByArtist = {};
            selectedTracks.forEach(track => {
                const artistName = track.artists[0].name;
                if (!tracksByArtist[artistName]) {
                    tracksByArtist[artistName] = [];
                }
                tracksByArtist[artistName].push(track.name);
            });
            
            // Tracks added by artist - clean format with indentation
            this.logger.info('Tracks added by artist:', null, 'CREATE_EXPLORER');
            Object.entries(tracksByArtist).forEach(([artist, tracks]) => {
                this.logger.info(`  ${artist}:`, null, 'CREATE_EXPLORER');
                tracks.forEach(track => {
                    this.logger.info(`    - ${track}`, null, 'CREATE_EXPLORER');
                });
            });
            
            // Sync the new playlist to local data
            this.logger.info(`Syncing new playlist to local data...`, null, 'SYNC_PLAYLIST');
            try {
                await this.syncPlaylists();
                this.logger.info(`Successfully synced playlist to data/spotify_playlists/ directory`, null, 'SYNC_PLAYLIST');
            } catch (error) {
                this.logger.warn(`Failed to sync playlist to local data: ${error.message}`, null, 'SYNC_PLAYLIST');
            }
            
            await this.db.close();
            return explorerPlaylist;
            
        } catch (error) {
            this.logger.error('Error creating Last.fm explorer playlist:', error.message);
            throw error;
        }
    }

    async createExplorerPlaylist(sourcePlaylistName) {
        console.log(`Creating explorer playlist for: ${sourcePlaylistName}`);
        
        try {
            // Load all playlists
            const playlistsFile = path.join(this.playlistsDir, 'all_playlists_detailed.json');
            if (!fs.existsSync(playlistsFile)) {
                throw new Error('No playlists found. Please run sync first.');
            }
            
            const allPlaylists = JSON.parse(fs.readFileSync(playlistsFile, 'utf8'));
            
            // Find source playlist
            const sourcePlaylist = allPlaylists.find(p => 
                p.name.toLowerCase() === sourcePlaylistName.toLowerCase()
            );
            
            if (!sourcePlaylist) {
                throw new Error(`Playlist "${sourcePlaylistName}" not found`);
            }
            
            console.log(`Found source playlist: ${sourcePlaylist.name} with ${sourcePlaylist.tracks.length} tracks`);
            
            // Analyze tracks to find top artists
            const artistCounts = {};
            const allTracks = new Set();
            
            // Collect all tracks from all playlists to avoid duplicates
            for (const playlist of allPlaylists) {
                for (const trackData of playlist.tracks) {
                    if (trackData.track && trackData.track.id) {
                        allTracks.add(trackData.track.id);
                    }
                }
            }
            
            // Count artists in source playlist
            for (const trackData of sourcePlaylist.tracks) {
                if (trackData.track && trackData.track.artists) {
                    for (const artist of trackData.track.artists) {
                        artistCounts[artist.id] = {
                            name: artist.name,
                            count: (artistCounts[artist.id]?.count || 0) + 1
                        };
                    }
                }
            }
            
            // Sort artists by frequency
            const topArtists = Object.entries(artistCounts)
                .sort(([,a], [,b]) => b.count - a.count)
                .slice(0, 10); // Top 10 artists
            
            console.log('Top artists in source playlist:');
            topArtists.forEach(([id, data]) => {
                console.log(`  ${data.name}: ${data.count} tracks`);
            });
            
            // Find lesser-known tracks from top artists
            const explorerTracks = [];
            const tracksPerArtist = Math.ceil(50 / topArtists.length); // Distribute tracks evenly
            
            for (const [artistId, artistData] of topArtists) {
                console.log(`Finding tracks for artist: ${artistData.name}`);
                
                try {
                    // Get artist's albums
                    const albums = await this.api.getArtistAlbums(artistId);
                    
                    // Get tracks from recent albums (not singles)
                    const albumTracks = [];
                    for (const album of albums.slice(0, 5)) { // Check last 5 albums
                        if (album.album_type === 'album') {
                            const tracks = await this.api.getAlbumTracks(album.id);
                            albumTracks.push(...tracks);
                        }
                    }
                    
                    console.log(`  Found ${albumTracks.length} album tracks for ${artistData.name}`);
                    
                    // Filter out tracks already in playlists and add lesser-known ones
                    let addedTracks = 0;
                    const artistTracks = [];
                    for (const track of albumTracks) {
                        // Only exclude if track is already in playlists, but don't require preview_url
                        if (!allTracks.has(track.id)) {
                            artistTracks.push({
                                ...track,
                                artist_name: artistData.name,
                                source_playlist: sourcePlaylistName
                            });
                        }
                    }
                    
                    // Sort by popularity (ascending - less popular first) for this artist
                    artistTracks.sort((a, b) => (a.popularity || 0) - (b.popularity || 0));
                    
                    // Take up to tracksPerArtist tracks from this artist
                    const selectedArtistTracks = artistTracks.slice(0, tracksPerArtist);
                    explorerTracks.push(...selectedArtistTracks);
                    
                    console.log(`  Added ${selectedArtistTracks.length} new tracks from ${artistData.name}`);
                    
                } catch (error) {
                    console.warn(`Error getting tracks for artist ${artistData.name}:`, error.message);
                }
            }
            
            // Remove duplicates based on track ID
            const uniqueTracks = [];
            const seenTrackIds = new Set();
            
            for (const track of explorerTracks) {
                if (!seenTrackIds.has(track.id)) {
                    seenTrackIds.add(track.id);
                    uniqueTracks.push(track);
                }
            }
            
            console.log(`Removed ${explorerTracks.length - uniqueTracks.length} duplicate tracks`);
            
            // Shuffle the final selection to mix artists
            const shuffledTracks = uniqueTracks.sort(() => Math.random() - 0.5);
            
            // Take top 50 tracks
            const selectedTracks = shuffledTracks.slice(0, 50);
            
            console.log(`Found ${selectedTracks.length} explorer tracks`);
            
            // Save explorer playlist locally
            const explorerPlaylist = {
                name: `${sourcePlaylistName} Explorer`,
                description: `Explorer playlist generated from ${sourcePlaylistName} - lesser-known tracks from top artists`,
                source_playlist: sourcePlaylistName,
                created_at: new Date().toISOString(),
                tracks: selectedTracks
            };
            
            // No need to save JSON file - we're creating actual Spotify playlists
            console.log(`Created explorer playlist: ${explorerPlaylist.name}`);
            
            return explorerPlaylist;
            
        } catch (error) {
            console.error('Error creating explorer playlist:', error.message);
            throw error;
        }
    }

    async addArtistToDillNDoo(artistName) {
        console.log(`Adding artist "${artistName}" to Dill 'n' Doo playlist`);
        
        try {
            // Search for artist
            const artists = await this.api.searchArtists(artistName);
            if (artists.length === 0) {
                throw new Error(`Artist "${artistName}" not found`);
            }
            
            const artist = artists[0];
            console.log(`Found artist: ${artist.name} (ID: ${artist.id})`);
            
            // Get current user
            const user = await this.api.getCurrentUser();
            
            // Check if Dill 'n' Doo playlist exists
            const playlists = await this.api.getUserPlaylists();
            let dillNDooPlaylist = playlists.find(p => 
                p.name.toLowerCase().includes("dill") && p.name.toLowerCase().includes("doo")
            );
            
            if (!dillNDooPlaylist) {
                console.log("Dill 'n' Doo playlist not found, creating it...");
                dillNDooPlaylist = await this.api.createPlaylist(
                    user.id, 
                    "Dill 'n' Doo", 
                    "Collection of favorite artists and their tracks"
                );
            }
            
            // Check if artist is already in the playlist
            const existingTracks = await this.api.getPlaylistTracks(dillNDooPlaylist.id);
            const artistTracks = existingTracks.filter(trackData => 
                trackData.track && trackData.track.artists.some(a => a.id === artist.id)
            );
            
            if (artistTracks.length > 0) {
                const errorMsg = `ERROR: Artist "${artist.name}" is already in Dill 'n' Doo playlist with ${artistTracks.length} tracks. This means the artist has already been manually curated. Do not add this artist again as it would overwrite the user's manual curation.`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
            
            // Get artist's top tracks
            const topTracks = await this.api.getArtistTopTracks(artist.id);
            const trackUris = topTracks.tracks.slice(0, 10).map(track => track.uri); // Add top 10 tracks
            
            // Add tracks to playlist
            await this.api.addTracksToPlaylist(dillNDooPlaylist.id, trackUris);
            console.log(`Added ${trackUris.length} tracks from ${artist.name} to Dill 'n' Doo`);
            
            // Optionally create/update explorer playlist
            try {
                await this.createExplorerPlaylist("Dill & Doo");
                console.log("Updated Dill & Doo explorer playlist");
            } catch (error) {
                console.warn("Could not update explorer playlist:", error.message);
            }
            
            return { playlist: dillNDooPlaylist, artist, addedTracks: trackUris.length };
            
        } catch (error) {
            console.error('Error adding artist to Dill \'n\' Doo:', error.message);
            throw error;
        }
    }

    async removeArtistFromDillNDoo(artistName) {
        console.log(`Removing artist "${artistName}" from Dill 'n' Doo playlist`);
        
        try {
            // Search for artist
            const artists = await this.api.searchArtists(artistName);
            if (artists.length === 0) {
                throw new Error(`Artist "${artistName}" not found`);
            }
            
            const artist = artists[0];
            console.log(`Found artist: ${artist.name} (ID: ${artist.id})`);
            
            // Find Dill 'n' Doo playlist
            const playlists = await this.api.getUserPlaylists();
            const dillNDooPlaylist = playlists.find(p => 
                p.name.toLowerCase().includes("dill") && p.name.toLowerCase().includes("doo")
            );
            
            if (!dillNDooPlaylist) {
                throw new Error("Dill 'n' Doo playlist not found");
            }
            
            // Get tracks by this artist
            const existingTracks = await this.api.getPlaylistTracks(dillNDooPlaylist.id);
            const artistTracks = existingTracks.filter(trackData => 
                trackData.track && trackData.track.artists.some(a => a.id === artist.id)
            );
            
            if (artistTracks.length === 0) {
                console.log(`No tracks from "${artist.name}" found in Dill 'n' Doo playlist`);
                return { playlist: dillNDooPlaylist, artist, removedTracks: 0 };
            }
            
            // Remove tracks
            const trackUris = artistTracks.map(trackData => trackData.track.uri);
            await this.api.removeTracksFromPlaylist(dillNDooPlaylist.id, trackUris);
            
            console.log(`Removed ${trackUris.length} tracks from ${artist.name} from Dill 'n' Doo`);
            
            return { playlist: dillNDooPlaylist, artist, removedTracks: trackUris.length };
            
        } catch (error) {
            console.error('Error removing artist from Dill \'n\' Doo:', error.message);
            throw error;
        }
    }
}

module.exports = PlaylistManager;