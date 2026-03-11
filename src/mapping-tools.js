const LastFmAPI = require('./lastfm-api');
const SpotifyAPI = require('./spotify-api');
const MappingDB = require('./mapping-db');
const FuzzyMatcher = require('./fuzzy-matcher');
const Logger = require('./logger');
const readline = require('readline');

class MappingTools {
    constructor() {
        this.lastfm = new LastFmAPI();
        this.spotify = new SpotifyAPI();
        this.db = new MappingDB();
        this.matcher = new FuzzyMatcher();
        this.logger = new Logger();
    }

    async init() {
        await this.db.init();
    }

    async mapArtist(artistName) {
        console.log(`\n=== Mapping Artist: ${artistName} ===`);
        
        try {
            // Check if already mapped
            const existingMapping = await this.db.getArtistMapping(artistName);
            if (existingMapping) {
                console.log(`Artist already mapped: ${existingMapping.spotify_artist_name} (${existingMapping.spotify_artist_id})`);
                return existingMapping;
            }

            // Search Last.fm for artist info
            console.log(`Searching Last.fm for "${artistName}"...`);
            const lastfmSearch = await this.lastfm.searchArtist(artistName);
            
            if (!lastfmSearch || !lastfmSearch.results || !lastfmSearch.results.artistmatches) {
                console.log(`No Last.fm results found for "${artistName}"`);
                return null;
            }

            const lastfmArtists = lastfmSearch.results.artistmatches.artist;
            if (!Array.isArray(lastfmArtists) || lastfmArtists.length === 0) {
                console.log(`No Last.fm artists found for "${artistName}"`);
                return null;
            }

            const lastfmArtist = lastfmArtists[0];
            console.log(`Found Last.fm artist: ${lastfmArtist.name}`);

            // Search Spotify for best match
            console.log(`Searching Spotify for best match...`);
            const spotifyMatch = await this.matcher.searchArtist(lastfmArtist.name);
            
            console.log(`Found Spotify match: ${spotifyMatch.name} (${spotifyMatch.id})`);
            console.log(`Levenshtein distance: ${spotifyMatch.levenshtein_distance}`);

            // Save mapping
            await this.db.saveArtistMapping(
                lastfmArtist.name,
                spotifyMatch.id,
                spotifyMatch.name,
                spotifyMatch.similarity_score
            );

            console.log(`✅ Artist mapping saved!`);
            return {
                lastfm_artist: lastfmArtist,
                spotify_artist: spotifyMatch
            };

        } catch (error) {
            if (error.code === 'NO_EXACT_MATCH') {
                console.log(`\n❌ NO EXACT MATCH FOUND for artist "${error.artistName}"`);
                console.log(`\nTop 5 closest matches:`);
                error.topMatches.forEach((match, index) => {
                    console.log(`  ${index + 1}. ${match.name} (ID: ${match.id})`);
                    console.log(`     Levenshtein distance: ${match.levenshtein_distance}`);
                    console.log(`     Similarity score: ${(match.similarity_score * 100).toFixed(1)}%`);
                });
                
                console.log(`\n🔧 MANUAL MAPPING REQUIRED`);
                console.log(`To fix this, run:`);
                console.log(`  make record-mapping ARTIST_NAME="${error.artistName}" LASTFM_TRACK="track_name" SPOTIFY_TRACK_ID="spotify_id"`);
                console.log(`\nExample:`);
                console.log(`  make record-mapping ARTIST_NAME="${error.artistName}" LASTFM_TRACK="Song Name" SPOTIFY_TRACK_ID="${error.topMatches[0].id}"`);
                console.log(`\nThis will create an exact mapping that bypasses fuzzy matching.`);
                
                // Log the error details
                const errorOutput = `Artist: ${error.artistName}\n` +
                                  `Top Matches:\n` +
                                  error.topMatches.map((match, i) => 
                                      `${i + 1}. ${match.name} (ID: ${match.id}) - Distance: ${match.levenshtein_distance}`
                                  ).join('\n') +
                                  `\n\nManual mapping command:\n` +
                                  `make record-mapping ARTIST_NAME="${error.artistName}" LASTFM_TRACK="track_name" SPOTIFY_TRACK_ID="spotify_id"`;
                
                
                throw error; // Re-throw to stop processing
            }
            
            console.error(`Error mapping artist "${artistName}":`, error.message);
            return null;
        }
    }

    async mapArtistTracks(artistName, maxTracks = 50) {
        console.log(`\n=== Mapping Tracks for Artist: ${artistName} ===`);
        
        try {
            // Get artist mapping
            const artistMapping = await this.db.getArtistMapping(artistName);
            if (!artistMapping) {
                console.log(`Artist "${artistName}" not mapped yet. Please map artist first.`);
                return null;
            }

            // Get top tracks from Last.fm
            console.log(`Getting top ${maxTracks} tracks from Last.fm...`);
            const lastfmTracks = await this.lastfm.getArtistTopTracks(artistName, maxTracks);
            
            if (!lastfmTracks || !lastfmTracks.toptracks || !lastfmTracks.toptracks.track) {
                console.log(`No Last.fm tracks found for "${artistName}"`);
                return null;
            }

            const tracks = Array.isArray(lastfmTracks.toptracks.track) 
                ? lastfmTracks.toptracks.track 
                : [lastfmTracks.toptracks.track];

            console.log(`Found ${tracks.length} tracks from Last.fm`);

            // Map tracks to Spotify one by one to catch errors early
            const mappedTracks = [];
            const unmappedTracks = [];
            const failedMappings = [];

            for (let i = 0; i < Math.min(tracks.length, maxTracks); i++) {
                const lastfmTrack = tracks[i];
                const trackName = lastfmTrack.name;
                
                try {
                    console.log(`\nMapping track ${i + 1}/${Math.min(tracks.length, maxTracks)}: ${trackName}`);
                    const spotifyMatch = await this.matcher.searchTrack(trackName, artistName);
                    
                    if (spotifyMatch) {
                        mappedTracks.push({
                            lastfm_track: lastfmTrack,
                            spotify_track: spotifyMatch,
                            confidence: spotifyMatch.similarity_score
                        });
                        
                        // Save track mapping
                        await this.db.saveTrackMapping(
                            artistName,
                            lastfmTrack.name,
                            spotifyMatch.id,
                            spotifyMatch.name,
                            spotifyMatch.artists[0].name,
                            spotifyMatch.similarity_score
                        );
                        
                        console.log(`✅ Mapped: ${trackName} -> ${spotifyMatch.name}`);
                    } else {
                        unmappedTracks.push({
                            lastfm_track: lastfmTrack,
                            reason: 'No suitable Spotify match found'
                        });
                        console.log(`❌ No match found for: ${trackName}`);
                    }
                } catch (error) {
                    if (error.code === 'NO_EXACT_MATCH') {
                        failedMappings.push({
                            lastfm_track: lastfmTrack,
                            error: error,
                            topMatches: error.topMatches
                        });
                        
                        console.log(`\n❌ NO EXACT MATCH FOUND for track "${trackName}" by "${artistName}"`);
                        console.log(`Top 5 closest matches:`);
                        error.topMatches.forEach((match, index) => {
                            console.log(`  ${index + 1}. ${match.name} by ${match.artists[0].name} (ID: ${match.id})`);
                            console.log(`     Levenshtein distance: ${match.levenshtein_distance}`);
                            console.log(`     Similarity score: ${(match.similarity_score * 100).toFixed(1)}%`);
                        });
                        
                        console.log(`\n🔧 MANUAL MAPPING REQUIRED for this track`);
                        console.log(`To fix this, run:`);
                        console.log(`  make record-mapping ARTIST_NAME="${artistName}" LASTFM_TRACK="${trackName}" SPOTIFY_TRACK_ID="spotify_id"`);
                        console.log(`\nExample:`);
                        console.log(`  make record-mapping ARTIST_NAME="${artistName}" LASTFM_TRACK="${trackName}" SPOTIFY_TRACK_ID="${error.topMatches[0].id}"`);
                        
                        // Log the error details
                        const errorOutput = `Track: ${trackName} by ${artistName}\n` +
                                          `Top Matches:\n` +
                                          error.topMatches.map((match, i) => 
                                              `${i + 1}. ${match.name} by ${match.artists[0].name} (ID: ${match.id}) - Distance: ${match.levenshtein_distance}`
                                          ).join('\n') +
                                          `\n\nManual mapping command:\n` +
                                          `make record-mapping ARTIST_NAME="${artistName}" LASTFM_TRACK="${trackName}" SPOTIFY_TRACK_ID="spotify_id"`;
                        
                        
                        // Stop processing on first failure
                        throw error;
                    } else {
                        unmappedTracks.push({
                            lastfm_track: lastfmTrack,
                            reason: `Error: ${error.message}`
                        });
                        console.log(`❌ Error mapping ${trackName}: ${error.message}`);
                    }
                }
            }

            console.log(`\n📊 Mapping Results:`);
            console.log(`✅ Mapped: ${mappedTracks.length} tracks`);
            console.log(`❌ Unmapped: ${unmappedTracks.length} tracks`);

            if (unmappedTracks.length > 0) {
                console.log(`\nUnmapped tracks:`);
                unmappedTracks.forEach((unmapped, index) => {
                    console.log(`  ${index + 1}. ${unmapped.lastfm_track.name} - ${unmapped.reason}`);
                });
            }

            return {
                mappedTracks,
                unmappedTracks,
                totalTracks: tracks.length
            };

        } catch (error) {
            if (error.code === 'NO_EXACT_MATCH') {
                // This error was already handled above, just re-throw
                throw error;
            }
            console.error(`Error mapping tracks for "${artistName}":`, error.message);
            return null;
        }
    }

    async interactiveMapArtist() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question('Enter artist name to map: ', async (artistName) => {
                rl.close();
                
                if (!artistName.trim()) {
                    console.log('No artist name provided');
                    resolve(null);
                    return;
                }

                const result = await this.mapArtist(artistName.trim());
                resolve(result);
            });
        });
    }

    async interactiveMapTracks() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question('Enter artist name to map tracks for: ', async (artistName) => {
                rl.close();
                
                if (!artistName.trim()) {
                    console.log('No artist name provided');
                    resolve(null);
                    return;
                }

                const result = await this.mapArtistTracks(artistName.trim());
                resolve(result);
            });
        });
    }

    async showMappingStatus() {
        console.log('\n=== Mapping Status ===');
        
        try {
            const artistMappings = await this.db.getAllArtistMappings();
            const trackMappings = await this.db.getAllTrackMappings();

            console.log(`\nArtists mapped: ${artistMappings.length}`);
            artistMappings.forEach(mapping => {
                console.log(`  ${mapping.lastfm_artist_name} -> ${mapping.spotify_artist_name} (${(mapping.confidence * 100).toFixed(1)}%)`);
            });

            console.log(`\nTracks mapped: ${trackMappings.length}`);
            
            // Group tracks by artist
            const tracksByArtist = {};
            trackMappings.forEach(track => {
                if (!tracksByArtist[track.lastfm_artist_name]) {
                    tracksByArtist[track.lastfm_artist_name] = [];
                }
                tracksByArtist[track.lastfm_artist_name].push(track);
            });

            Object.keys(tracksByArtist).forEach(artist => {
                console.log(`  ${artist}: ${tracksByArtist[artist].length} tracks`);
            });

        } catch (error) {
            console.error('Error showing mapping status:', error.message);
        }
    }

    async recordManualMappings(artistName, mappings) {
        this.logger.info(`Recording manual mappings for artist: ${artistName}`, {
            artist: artistName,
            mapping_count: mappings.length
        });

        try {
            for (const mapping of mappings) {
                await this.db.saveTrackMapping(
                    artistName,
                    mapping.lastfmTrack,
                    mapping.spotifyTrackId,
                    mapping.spotifyTrackName,
                    mapping.spotifyArtistName || artistName,
                    1.0 // Manual mappings have 100% confidence
                );
                
                this.logger.debug(`Recorded mapping: ${mapping.lastfmTrack} -> ${mapping.spotifyTrackName}`, {
                    lastfm_track: mapping.lastfmTrack,
                    spotify_track_id: mapping.spotifyTrackId,
                    spotify_track_name: mapping.spotifyTrackName
                });
            }

            this.logger.info(`Successfully recorded ${mappings.length} manual mappings for ${artistName}`);
            return true;
        } catch (error) {
            this.logger.error(`Error recording manual mappings for ${artistName}: ${error.message}`);
            return false;
        }
    }

    async close() {
        await this.db.close();
    }
}

module.exports = MappingTools;