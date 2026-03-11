const https = require('https');
const LastFmAuth = require('./lastfm-auth');
const LastFmCache = require('./lastfm-cache');

class LastFmAPI {
    constructor() {
        this.auth = new LastFmAuth();
        this.cache = new LastFmCache();
        this.apiKey = process.env.LASTFM_API_KEY;
        this.baseUrl = 'ws.audioscrobbler.com';
    }

    async makeRequest(method, params = {}) {
        const allParams = {
            method: method,
            api_key: this.apiKey,
            format: 'json',
            ...params
        };

        const queryString = new URLSearchParams(allParams).toString();
        const url = `https://${this.baseUrl}/2.0/?${queryString}`;

        return new Promise((resolve, reject) => {
            const req = https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.error) {
                            reject(new Error(`Last.fm API Error: ${response.message}`));
                        } else {
                            resolve(response);
                        }
                    } catch (error) {
                        reject(new Error('Failed to parse Last.fm API response: ' + error.message));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });
        });
    }

    async getArtistTopTracks(artist, limit = 50) {
        // Check cache first
        const cachedData = this.cache.getCachedData(artist);
        if (cachedData) {
            console.log(`📦 Using cached data for ${artist}`);
            return cachedData;
        }

        // Fetch from API
        console.log(`🌐 Fetching fresh data for ${artist} from Last.fm`);
        const data = await this.makeRequest('artist.gettoptracks', {
            artist: artist,
            limit: limit
        });

        // Cache the data
        this.cache.cacheData(artist, data);
        
        return data;
    }

    async getArtistInfo(artist) {
        return this.makeRequest('artist.getinfo', {
            artist: artist
        });
    }

    async searchArtist(artist, limit = 10) {
        return this.makeRequest('artist.search', {
            artist: artist,
            limit: limit
        });
    }

    async getTrackInfo(artist, track) {
        return this.makeRequest('track.getinfo', {
            artist: artist,
            track: track
        });
    }

    async getUserTopArtists(username, period = 'overall', limit = 50) {
        return this.makeRequest('user.gettopartists', {
            user: username,
            period: period,
            limit: limit
        });
    }

    async getUserTopTracks(username, period = 'overall', limit = 50) {
        return this.makeRequest('user.gettoptracks', {
            user: username,
            period: period,
            limit: limit
        });
    }

    async getArtistTopAlbums(artist, limit = 50) {
        return this.makeRequest('artist.gettopalbums', {
            artist: artist,
            limit: limit
        });
    }

    async getSession(token) {
        return this.makeRequest('auth.getSession', {
            token: token
        });
    }
}

module.exports = LastFmAPI;