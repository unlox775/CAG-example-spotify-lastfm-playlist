const https = require('https');
const crypto = require('crypto');
const { TokenStore } = require('./token-store');

class LastFmAuth {
    constructor() {
        this.apiKey = process.env.LASTFM_API_KEY;
        this.secret = process.env.LASTFM_SHARED_SECRET || process.env.LASTFM_SECRET;
        this.redirectUri = process.env.LASTFM_REDIRECT_URI || process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:8888/callback';
        this.store = new TokenStore();
        this.tokenKey = 'lastfm_token';
    }

    generateAuthUrl() {
        if (!this.apiKey) {
            throw new Error('LASTFM_API_KEY environment variable is required');
        }

        const params = new URLSearchParams({
            api_key: this.apiKey,
            cb: this.redirectUri
        });

        return `https://www.last.fm/api/auth?${params.toString()}`;
    }

    async getSession(token) {
        if (!this.apiKey) {
            throw new Error('LASTFM_API_KEY environment variable is required');
        }
        if (!this.secret) {
            throw new Error('LASTFM_SHARED_SECRET (or LASTFM_SECRET) environment variable is required');
        }

        const method = 'auth.getSession';
        const apiSig = this.generateApiSignature(method, { token });
        
        const postData = new URLSearchParams({
            method: method,
            api_key: this.apiKey,
            token: token,
            api_sig: apiSig,
            format: 'json'
        }).toString();

        const options = {
            hostname: 'ws.audioscrobbler.com',
            port: 443,
            path: '/2.0/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.session) {
                            this.saveToken({
                                session_key: response.session.key,
                                username: response.session.name,
                                expires_at: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year
                            });
                            resolve(response.session);
                        } else {
                            reject(new Error('Failed to get session: ' + JSON.stringify(response)));
                        }
                    } catch (error) {
                        reject(new Error('Failed to parse session response: ' + error.message));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    }

    generateApiSignature(method, params = {}) {
        if (!this.secret) {
            throw new Error('LASTFM_SHARED_SECRET (or LASTFM_SECRET) environment variable is required');
        }

        const allParams = {
            method: method,
            api_key: this.apiKey,
            ...params
        };

        // Sort parameters and create signature string
        const sortedParams = Object.keys(allParams)
            .sort()
            .map(key => `${key}${allParams[key]}`)
            .join('');

        const signatureString = sortedParams + this.secret;
        return crypto.createHash('md5').update(signatureString).digest('hex');
    }

    async loadToken() {
        try {
            const tokenData = await this.store.get(this.tokenKey);
            return tokenData;
        } catch (error) {
            console.error('Error loading Last.fm token:', error.message);
        }
        return null;
    }

    async saveToken(tokenData) {
        try {
            await this.store.set(this.tokenKey, tokenData);
            console.log('Last.fm token saved successfully to local store');
        } catch (error) {
            console.error('Error saving Last.fm token:', error.message);
        }
    }

    async getValidToken() {
        const tokenData = await this.loadToken();
        if (!tokenData) {
            throw new Error('No Last.fm token found. Please authenticate first.');
        }

        // Check if token is expired
        if (tokenData.expires_at && Date.now() >= tokenData.expires_at) {
            throw new Error('Last.fm token expired. Please re-authenticate.');
        }

        return tokenData.session_key;
    }
}

module.exports = LastFmAuth;
