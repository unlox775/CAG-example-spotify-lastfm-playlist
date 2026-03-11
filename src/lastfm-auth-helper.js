#!/usr/bin/env node

const LastFmAuth = require('./lastfm-auth');
const readline = require('readline');

class LastFmAuthHelper {
    constructor() {
        this.auth = new LastFmAuth();
    }

    async authenticate() {
        try {
            console.log('Last.fm Authentication Helper');
            console.log('============================');
            console.log('');
            
            if (!this.auth.apiKey) {
                throw new Error('LASTFM_API_KEY environment variable not set');
            }
            
            if (!this.auth.secret) {
                throw new Error('LASTFM_SHARED_SECRET (or LASTFM_SECRET) environment variable not set');
            }

            const authUrl = this.auth.generateAuthUrl();
            
            console.log('1. Open this URL in your browser:');
            console.log('');
            console.log(authUrl);
            console.log('');
            console.log('2. After authorizing, you will be redirected to:');
            console.log(`   ${this.auth.redirectUri}?token=...`);
            console.log('');
            console.log('3. Copy the "token" parameter from the URL and paste it below:');
            console.log('');

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const token = await new Promise((resolve) => {
                rl.question('Authorization token: ', (token) => {
                    rl.close();
                    resolve(token.trim());
                });
            });

            if (!token) {
                throw new Error('No token provided');
            }

            console.log('Exchanging token for session...');
            const session = await this.auth.getSession(token);
            
            console.log('');
            console.log('Authentication successful!');
            console.log('Username:', session.name);
            console.log('Session key:', session.key);
            
        } catch (error) {
            console.error('Authentication failed:', error.message);
            process.exit(1);
        }
    }
}

async function main() {
    const helper = new LastFmAuthHelper();
    await helper.authenticate();
}

if (require.main === module) {
    main();
}

module.exports = LastFmAuthHelper;
