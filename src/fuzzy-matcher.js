const SpotifyAPI = require('./spotify-api');
const Logger = require('./logger');
const MappingDB = require('./mapping-db');

class FuzzyMatcher {
    constructor() {
        this.spotify = new SpotifyAPI();
        this.logger = new Logger();
        this.db = new MappingDB();
        this.dbReady = this.db.init().catch((error) => {
            this.logger.warn(`Failed to initialize mapping database: ${error.message}`);
        });
    }

    // Levenshtein distance calculation
    levenshteinDistance(str1, str2) {
        const matrix = [];
        const len1 = str1.length;
        const len2 = str2.length;

        for (let i = 0; i <= len2; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= len1; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len2; i++) {
            for (let j = 1; j <= len1; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[len2][len1];
    }

    // Calculate similarity score (0-1, higher is better)
    calculateSimilarity(str1, str2) {
        const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
        const maxLength = Math.max(str1.length, str2.length);
        return maxLength === 0 ? 1 : 1 - (distance / maxLength);
    }

    // Normalize strings for better matching
    normalizeString(str) {
        return str
            .toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\bthe\b/g, '') // Remove "the" for better matching
            .replace(/\bs\b/g, '') // Remove standalone "s" (plurals)
            .replace(/\bsound\b/g, 'sounds') // Normalize "sound" to "sounds"
            .replace(/\bsounds\b/g, 'sounds') // Keep "sounds" as is
            .trim();
    }

    // Find best artist match from Spotify search results
    async findBestArtistMatch(lastfmArtistName, spotifyArtists) {
        const normalizedLastfm = this.normalizeString(lastfmArtistName);
        
        // Calculate Levenshtein distance for all artists and sort by distance
        const artistsWithDistance = spotifyArtists.map(artist => {
            const normalizedSpotify = this.normalizeString(artist.name);
            const distance = this.levenshteinDistance(normalizedLastfm, normalizedSpotify);
            const score = this.calculateSimilarity(normalizedLastfm, normalizedSpotify);
            
            return {
                ...artist,
                levenshtein_distance: distance,
                similarity_score: score
            };
        }).sort((a, b) => a.levenshtein_distance - b.levenshtein_distance);

        // Check for exact match (Levenshtein distance ≤ 1)
        const exactMatch = artistsWithDistance.find(artist => artist.levenshtein_distance <= 1);
        if (exactMatch) {
            return exactMatch;
        }

        // No exact match found - return null to trigger error handling
        return null;
    }

    // Find best track match from Spotify search results
    async findBestTrackMatch(lastfmTrackName, lastfmArtistName, spotifyTracks) {
        const normalizedLastfmTrack = this.normalizeString(lastfmTrackName);
        const normalizedLastfmArtist = this.normalizeString(lastfmArtistName);
        
        // Calculate Levenshtein distance for all tracks and sort by distance
        const tracksWithDistance = spotifyTracks.map(track => {
            const normalizedSpotifyTrack = this.normalizeString(track.name);
            const normalizedSpotifyArtist = this.normalizeString(track.artists[0].name);
            
            // Calculate combined distance for track and artist
            const trackDistance = this.levenshteinDistance(normalizedLastfmTrack, normalizedSpotifyTrack);
            const artistDistance = this.levenshteinDistance(normalizedLastfmArtist, normalizedSpotifyArtist);
            const combinedDistance = trackDistance + artistDistance; // Sum of distances
            
            // Calculate similarity scores for reference
            const trackScore = this.calculateSimilarity(normalizedLastfmTrack, normalizedSpotifyTrack);
            const artistScore = this.calculateSimilarity(normalizedLastfmArtist, normalizedSpotifyArtist);
            const combinedScore = (trackScore * 0.7) + (artistScore * 0.3);
            
            // Prefer non-live versions
            const isLive = normalizedSpotifyTrack.includes('live') || 
                          normalizedSpotifyTrack.includes('concert') ||
                          track.name.includes('(Live)') ||
                          track.name.includes('(live)');
            
            const finalScore = isLive ? combinedScore * 0.8 : combinedScore;
            
            return {
                ...track,
                levenshtein_distance: combinedDistance,
                track_distance: trackDistance,
                artist_distance: artistDistance,
                similarity_score: finalScore,
                is_live: isLive
            };
        }).sort((a, b) => a.levenshtein_distance - b.levenshtein_distance);

        // Check for exact match (combined Levenshtein distance ≤ 2)
        const exactMatch = tracksWithDistance.find(track => track.levenshtein_distance <= 2);
        if (exactMatch) {
            return exactMatch;
        }

        // No exact match found - return null to trigger error handling
        return null;
    }

    // Search Spotify for artist and return best match
    async searchArtist(lastfmArtistName) {
        try {
            this.logger.debug(`Searching Spotify for artist: ${lastfmArtistName}`);
            const spotifyArtists = await this.spotify.searchArtists(lastfmArtistName, 20);
            
            this.logger.logArtistMappingAttempt(lastfmArtistName, spotifyArtists);
            
            const bestMatch = await this.findBestArtistMatch(lastfmArtistName, spotifyArtists);
            
            if (bestMatch) {
                this.logger.logArtistMappingSuccess(lastfmArtistName, bestMatch);
                return bestMatch;
            } else {
                // No exact match found - throw error with top 5 matches for manual mapping
                const artistsWithDistance = spotifyArtists.map(artist => {
                    const normalizedLastfm = this.normalizeString(lastfmArtistName);
                    const normalizedSpotify = this.normalizeString(artist.name);
                    const distance = this.levenshteinDistance(normalizedLastfm, normalizedSpotify);
                    const score = this.calculateSimilarity(normalizedLastfm, normalizedSpotify);
                    
                    return {
                        ...artist,
                        levenshtein_distance: distance,
                        similarity_score: score
                    };
                }).sort((a, b) => a.levenshtein_distance - b.levenshtein_distance);
                
                const top5Matches = artistsWithDistance.slice(0, 5);
                
                const error = new Error(`No exact match found for artist "${lastfmArtistName}"`);
                error.code = 'NO_EXACT_MATCH';
                error.artistName = lastfmArtistName;
                error.topMatches = top5Matches;
                
                this.logger.logArtistMappingFailure(lastfmArtistName, spotifyArtists, 'No exact match found');
                throw error;
            }
        } catch (error) {
            if (error.code === 'NO_EXACT_MATCH') {
                throw error; // Re-throw our custom error
            }
            this.logger.error(`Error searching for artist "${lastfmArtistName}": ${error.message}`);
            return null;
        }
    }

    // Search Spotify for track and return best match
    async searchTrack(lastfmTrackName, lastfmArtistName) {
        try {
            // Check for existing mapping first
            try {
                await this.dbReady;
                const existingMapping = await this.db.getTrackMapping(lastfmArtistName, lastfmTrackName);
                if (existingMapping) {
                    this.logger.debug(`Using existing mapping: ${lastfmTrackName} -> ${existingMapping.spotify_track_name}`);
                    return {
                        id: existingMapping.spotify_track_id,
                        name: existingMapping.spotify_track_name,
                        uri: `spotify:track:${existingMapping.spotify_track_id}`,
                        artists: [{
                            name: existingMapping.spotify_artist_name
                        }],
                        similarity_score: existingMapping.confidence
                    };
                }
            } catch (error) {
                this.logger.warn(`Unable to load cached mapping for "${lastfmTrackName}": ${error.message}`);
            }

            this.logger.debug(`Searching Spotify for track: ${lastfmTrackName} by ${lastfmArtistName}`);
            const query = `track:"${lastfmTrackName}" artist:"${lastfmArtistName}"`;
            const response = await this.spotify.makeRequest(`/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`);
            const spotifyTracks = response.tracks.items;
            
            this.logger.logMappingAttempt(lastfmArtistName, lastfmTrackName, spotifyTracks);
            
            const bestMatch = await this.findBestTrackMatch(lastfmTrackName, lastfmArtistName, spotifyTracks);
            
            if (bestMatch) {
                this.logger.logMappingSuccess(lastfmArtistName, lastfmTrackName, bestMatch);
                return bestMatch;
            } else {
                // No exact match found - throw error with top 5 matches for manual mapping
                const tracksWithDistance = spotifyTracks.map(track => {
                    const normalizedLastfmTrack = this.normalizeString(lastfmTrackName);
                    const normalizedLastfmArtist = this.normalizeString(lastfmArtistName);
                    const normalizedSpotifyTrack = this.normalizeString(track.name);
                    const normalizedSpotifyArtist = this.normalizeString(track.artists[0].name);
                    
                    const trackDistance = this.levenshteinDistance(normalizedLastfmTrack, normalizedSpotifyTrack);
                    const artistDistance = this.levenshteinDistance(normalizedLastfmArtist, normalizedSpotifyArtist);
                    const combinedDistance = trackDistance + artistDistance;
                    
                    const trackScore = this.calculateSimilarity(normalizedLastfmTrack, normalizedSpotifyTrack);
                    const artistScore = this.calculateSimilarity(normalizedLastfmArtist, normalizedSpotifyArtist);
                    const combinedScore = (trackScore * 0.7) + (artistScore * 0.3);
                    
                    const isLive = normalizedSpotifyTrack.includes('live') || 
                                  normalizedSpotifyTrack.includes('concert') ||
                                  track.name.includes('(Live)') ||
                                  track.name.includes('(live)');
                    
                    const finalScore = isLive ? combinedScore * 0.8 : combinedScore;
                    
                    return {
                        ...track,
                        levenshtein_distance: combinedDistance,
                        track_distance: trackDistance,
                        artist_distance: artistDistance,
                        similarity_score: finalScore,
                        is_live: isLive
                    };
                }).sort((a, b) => a.levenshtein_distance - b.levenshtein_distance);
                
                const top5Matches = tracksWithDistance.slice(0, 5);
                
                const error = new Error(`No exact match found for track "${lastfmTrackName}" by "${lastfmArtistName}"`);
                error.code = 'NO_EXACT_MATCH';
                error.trackName = lastfmTrackName;
                error.artistName = lastfmArtistName;
                error.topMatches = top5Matches;
                
                this.logger.logMappingFailure(lastfmArtistName, lastfmTrackName, spotifyTracks, 'No exact match found');
                throw error;
            }
        } catch (error) {
            if (error.code === 'NO_EXACT_MATCH') {
                throw error; // Re-throw our custom error
            }
            this.logger.error(`Error searching for track "${lastfmTrackName}" by "${lastfmArtistName}": ${error.message}`);
            return null;
        }
    }

    // Get top tracks for an artist from Last.fm and find Spotify matches
    async mapArtistTopTracks(lastfmArtistName, lastfmTracks, maxTracks = 5) {
        const mappedTracks = [];
        const unmappedTracks = [];

        for (let i = 0; i < Math.min(lastfmTracks.length, maxTracks); i++) {
            const lastfmTrack = lastfmTracks[i];
            const trackName = lastfmTrack.name;
            
            try {
                const spotifyMatch = await this.searchTrack(trackName, lastfmArtistName);
                
                if (spotifyMatch) {
                    mappedTracks.push({
                        lastfm_track: lastfmTrack,
                        spotify_track: spotifyMatch,
                        confidence: spotifyMatch.similarity_score
                    });
                } else {
                    unmappedTracks.push({
                        lastfm_track: lastfmTrack,
                        reason: 'No suitable Spotify match found'
                    });
                }
            } catch (error) {
                unmappedTracks.push({
                    lastfm_track: lastfmTrack,
                    reason: `Error: ${error.message}`
                });
            }
        }

        return { mappedTracks, unmappedTracks };
    }
}

module.exports = FuzzyMatcher;
