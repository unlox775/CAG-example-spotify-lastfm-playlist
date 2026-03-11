#!/usr/bin/env node

const https = require('https');
const readline = require('readline');
const { TokenStore } = require('./token-store');

class AuthHelper {
    constructor() {
        this.clientId = process.env.SPOTIFY_CLIENT_ID;
        this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:8888/callback';
        this.scopes = [
            'playlist-read-private',
            'playlist-read-collaborative',
            'playlist-modify-public',
            'playlist-modify-private',
            'user-read-private',
            'user-read-email'
        ].join(' ');

        this.store = new TokenStore();
        this.tokenKey = 'spotify_token';
    }

    generateAuthUrl() {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            scope: this.scopes,
            redirect_uri: this.redirectUri,
            state: 'xyz'
        });

        return `https://accounts.spotify.com/authorize?${params.toString()}`;
    }

    async getAuthCode() {
        const authUrl = this.generateAuthUrl();
        
        console.log('Spotify Authentication Helper');
        console.log('============================');
        console.log('');
        console.log('1. Open this URL in your browser:');
        console.log('');
        console.log(authUrl);
        console.log('');
        console.log('2. After authorizing, you will be redirected to:');
        console.log(`   ${this.redirectUri}?code=...&state=xyz`);
        console.log('');
        console.log('3. Copy the "code" parameter from the URL and paste it below:');
        console.log('');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question('Authorization code: ', (code) => {
                rl.close();
                resolve(code.trim());
            });
        });
    }

    async exchangeCodeForToken(authorizationCode) {
        const postData = new URLSearchParams({
            grant_type: 'authorization_code',
            code: authorizationCode,
            redirect_uri: this.redirectUri,
            client_id: this.clientId,
            client_secret: process.env.SPOTIFY_SECRET_ID
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

    async saveToken(tokenData) {
        // Add expiration timestamp
        if (tokenData.expires_in && !tokenData.expires_at) {
            tokenData.expires_at = Date.now() + (tokenData.expires_in * 1000);
        }
        
        await this.store.set(this.tokenKey, tokenData);
        console.log('Token saved successfully to local store');
    }

    async authenticate() {
        try {
            console.log('Starting Spotify authentication...');
            
            if (!this.clientId) {
                throw new Error('SPOTIFY_CLIENT_ID environment variable not set');
            }
            
            if (!process.env.SPOTIFY_SECRET_ID) {
                throw new Error('SPOTIFY_SECRET_ID environment variable not set');
            }

            const authCode = await this.getAuthCode();
            const tokenData = await this.exchangeCodeForToken(authCode);
            await this.saveToken(tokenData);
            
            console.log('');
            console.log('Authentication successful!');
            console.log('Access token:', tokenData.access_token);
            console.log('Token expires at:', new Date(tokenData.expires_at).toISOString());
            
        } catch (error) {
            console.error('Authentication failed:', error.message);
            process.exit(1);
        }
    }
}

async function main() {
    const helper = new AuthHelper();
    await helper.authenticate();
}

if (require.main === module) {
    main();
}

module.exports = AuthHelper;
