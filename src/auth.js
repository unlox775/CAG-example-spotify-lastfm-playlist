const https = require('https');
const { TokenStore } = require('./token-store');

class SpotifyAuth {
    constructor() {
        this.clientId = process.env.SPOTIFY_CLIENT_ID;
        this.clientSecret = process.env.SPOTIFY_SECRET_ID;
        this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:8888/callback';
        this.store = new TokenStore();
        this.tokenKey = 'spotify_token';
    }

    async exchangeCodeForToken(authorizationCode) {
        if (!this.clientId || !this.clientSecret) {
            throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_SECRET_ID environment variables are required');
        }

        const postData = new URLSearchParams({
            grant_type: 'authorization_code',
            code: authorizationCode,
            redirect_uri: this.redirectUri,
            client_id: this.clientId,
            client_secret: this.clientSecret
        }).toString();

        const options = {
            hostname: 'accounts.spotify.com',
            port: 443,
            path: '/api/token',
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
                        const tokenData = JSON.parse(data);
                        if (tokenData.access_token) {
                            this.saveToken(tokenData);
                            resolve(tokenData);
                        } else {
                            reject(new Error('Failed to get access token: ' + data));
                        }
                    } catch (error) {
                        reject(new Error('Failed to parse token response: ' + error.message));
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

    async refreshToken() {
        if (!this.clientId || !this.clientSecret) {
            throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_SECRET_ID environment variables are required');
        }

        const tokenData = await this.loadToken();
        if (!tokenData || !tokenData.refresh_token) {
            throw new Error('No refresh token available. Please re-authenticate.');
        }

        const postData = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokenData.refresh_token,
            client_id: this.clientId,
            client_secret: this.clientSecret
        }).toString();

        const options = {
            hostname: 'accounts.spotify.com',
            port: 443,
            path: '/api/token',
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
                        const newTokenData = JSON.parse(data);
                        if (newTokenData.access_token) {
                            // Merge with existing token data to preserve refresh token
                            const updatedTokenData = {
                                ...tokenData,
                                ...newTokenData,
                                expires_at: Date.now() + (newTokenData.expires_in * 1000)
                            };
                            this.saveToken(updatedTokenData);
                            resolve(updatedTokenData);
                        } else {
                            reject(new Error('Failed to refresh token: ' + data));
                        }
                    } catch (error) {
                        reject(new Error('Failed to parse refresh response: ' + error.message));
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

    async loadToken() {
        try {
            const tokenData = await this.store.get(this.tokenKey);
            return tokenData;
        } catch (error) {
            console.error('Error loading token:', error.message);
        }
        return null;
    }

    async saveToken(tokenData) {
        try {
            // Add expiration timestamp
            if (tokenData.expires_in && !tokenData.expires_at) {
                tokenData.expires_at = Date.now() + (tokenData.expires_in * 1000);
            }
            
            await this.store.set(this.tokenKey, tokenData);
            console.log('Token saved successfully to local store');
        } catch (error) {
            console.error('Error saving token:', error.message);
        }
    }

    async getValidToken() {
        const tokenData = await this.loadToken();
        if (!tokenData) {
            throw new Error('No token found. Please authenticate first.');
        }

        // Check if token is expired (with 5 minute buffer)
        if (tokenData.expires_at && Date.now() >= (tokenData.expires_at - 300000)) {
            throw new Error('Token expired. Please refresh.');
        }

        return tokenData.access_token;
    }

    async getValidTokenOrRefresh() {
        try {
            return await this.getValidToken();
        } catch (error) {
            if (error.message.includes('expired') || error.message.includes('No token found')) {
                console.log('Token expired or not found, refreshing...');
                const refreshedToken = await this.refreshToken();
                return refreshedToken.access_token;
            }
            throw error;
        }
    }
}

module.exports = SpotifyAuth;
