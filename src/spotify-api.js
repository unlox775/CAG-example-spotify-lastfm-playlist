const https = require('https');
const SpotifyAuth = require('./auth');

class SpotifyAPI {
    constructor() {
        this.auth = new SpotifyAuth();
        this.baseUrl = 'api.spotify.com';
    }

    /**
     * Filter Spotify data to only include essential fields
     * Reduces file sizes by ~90% by removing unused metadata
     */
    filterSpotifyData(data) {
        if (Array.isArray(data)) {
            return data.map(item => this.filterSpotifyData(item));
        }

        if (typeof data !== 'object' || data === null) {
            return data;
        }

        // Handle playlist track wrapper objects (added_at, added_by, track)
        if (data.added_at && data.added_by && data.track) {
            return {
                added_at: data.added_at,
                added_by: {
                    id: data.added_by.id
                },
                track: this.filterSpotifyData(data.track)
            };
        }
        
        // Handle track objects (both direct tracks and nested track objects)
        if (data.type === 'track' || (data.id && data.name && data.uri && !data.added_at)) {
            return {
                id: data.id,
                name: data.name,
                uri: data.uri,
                artists: data.artists ? data.artists.map(artist => ({
                    id: artist.id,
                    name: artist.name
                })) : [],
                album: data.album ? {
                    id: data.album.id,
                    name: data.album.name,
                    album_type: data.album.album_type
                } : null
            };
        }

        // Handle playlist objects
        if (data.type === 'playlist' || data.tracks) {
            const filtered = {
                id: data.id,
                name: data.name,
                description: data.description || ''
            };
            
            if (data.tracks) {
                filtered.tracks = this.filterSpotifyData(data.tracks);
            }
            
            return filtered;
        }

        // Handle artist objects
        if (data.type === 'artist') {
            return {
                id: data.id,
                name: data.name
            };
        }

        // Handle album objects
        if (data.type === 'album') {
            return {
                id: data.id,
                name: data.name,
                album_type: data.album_type
            };
        }
        
        // Handle user objects
        if (data.type === 'user') {
            return {
                id: data.id
            };
        }

        // For other objects, recursively filter
        const filtered = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'object' && value !== null) {
                filtered[key] = this.filterSpotifyData(value);
            } else {
                filtered[key] = value;
            }
        }
        
        return filtered;
    }

    async makeRequest(endpoint, method = 'GET', body = null) {
        const token = await this.auth.getValidTokenOrRefresh();
        
        const options = {
            hostname: this.baseUrl,
            port: 443,
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
        }

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const responseData = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(responseData);
                        } else {
                            reject(new Error(`API Error ${res.statusCode}: ${responseData.error?.message || data}`));
                        }
                    } catch (error) {
                        reject(new Error('Failed to parse API response: ' + error.message));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }

    async getCurrentUser() {
        return this.makeRequest('/v1/me');
    }

    async getUserPlaylists(limit = 50, offset = 0) {
        const playlists = [];
        let hasNext = true;
        let currentOffset = offset;

        while (hasNext) {
            const response = await this.makeRequest(`/v1/me/playlists?limit=${limit}&offset=${currentOffset}`);
            playlists.push(...response.items);
            
            hasNext = response.next !== null;
            currentOffset += limit;
        }

        return playlists;
    }

    async getPlaylistTracks(playlistId, limit = 100, offset = 0) {
        const tracks = [];
        let hasNext = true;
        let currentOffset = offset;

        while (hasNext) {
            const response = await this.makeRequest(`/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${currentOffset}`);
            tracks.push(...response.items);
            
            hasNext = response.next !== null;
            currentOffset += limit;
        }

        return tracks;
    }

    async getPlaylistDetails(playlistId) {
        return this.makeRequest(`/v1/playlists/${playlistId}`);
    }

    async searchArtists(query, limit = 20) {
        const response = await this.makeRequest(`/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=${limit}`);
        return response.artists.items;
    }

    async searchTracks(query, limit = 20) {
        const response = await this.makeRequest(`/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`);
        return response.tracks;
    }

    async getArtistTopTracks(artistId, market = 'US') {
        return this.makeRequest(`/v1/artists/${artistId}/top-tracks?market=${market}`);
    }

    async getArtistAlbums(artistId, limit = 50, offset = 0) {
        const albums = [];
        let hasNext = true;
        let currentOffset = offset;

        while (hasNext) {
            const response = await this.makeRequest(`/v1/artists/${artistId}/albums?limit=${limit}&offset=${currentOffset}&include_groups=album,single`);
            albums.push(...response.items);
            
            hasNext = response.next !== null;
            currentOffset += limit;
        }

        return albums;
    }

    async getAlbumTracks(albumId, limit = 50, offset = 0) {
        const tracks = [];
        let hasNext = true;
        let currentOffset = offset;

        while (hasNext) {
            const response = await this.makeRequest(`/v1/albums/${albumId}/tracks?limit=${limit}&offset=${currentOffset}`);
            tracks.push(...response.items);
            
            hasNext = response.next !== null;
            currentOffset += limit;
        }

        return tracks;
    }

    async createPlaylist(userId, name, description = '', isPublic = false) {
        const body = {
            name: name,
            description: description,
            public: isPublic
        };

        return this.makeRequest(`/v1/users/${userId}/playlists`, 'POST', body);
    }

    async addTracksToPlaylist(playlistId, trackUris) {
        const body = {
            uris: trackUris
        };

        return this.makeRequest(`/v1/playlists/${playlistId}/tracks`, 'POST', body);
    }

    async deletePlaylist(playlistId) {
        // Note: Spotify API doesn't allow deleting playlists directly
        // We can only unfollow them, which removes them from user's library
        try {
            const response = await this.makeRequest(`/v1/playlists/${playlistId}/followers`, 'DELETE');
            return response;
        } catch (error) {
            // DELETE requests often return empty responses, which is normal
            if (error.message.includes('Unexpected end of JSON input')) {
                return { success: true };
            }
            throw error;
        }
    }

    async removeTracksFromPlaylist(playlistId, trackUris) {
        const body = {
            tracks: trackUris.map(uri => ({ uri: uri }))
        };

        return this.makeRequest(`/v1/playlists/${playlistId}/tracks`, 'DELETE', body);
    }

    async clearPlaylistTracks(playlistId) {
        console.log(`Clearing all tracks from playlist: ${playlistId}`);
        try {
            // Get current tracks
            const tracks = await this.getPlaylistTracks(playlistId);
            
            if (tracks.length === 0) {
                console.log(`Playlist ${playlistId} is already empty`);
                return;
            }
            
            // Create array of track URIs to remove
            const trackUris = tracks.map(trackData => trackData.track.uri);
            
            // Remove tracks in batches of 100 (Spotify limit)
            const batchSize = 100;
            for (let i = 0; i < trackUris.length; i += batchSize) {
                const batch = trackUris.slice(i, i + batchSize);
                await this.makeRequest(`/v1/playlists/${playlistId}/tracks`, 'DELETE', {
                    tracks: batch.map(uri => ({ uri }))
                });
            }
            
            console.log(`Successfully cleared ${trackUris.length} tracks from playlist: ${playlistId}`);
        } catch (error) {
            console.error(`Failed to clear playlist tracks ${playlistId}:`, error);
            throw error;
        }
    }
}

module.exports = SpotifyAPI;