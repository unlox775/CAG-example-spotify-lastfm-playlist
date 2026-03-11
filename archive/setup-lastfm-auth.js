#!/usr/bin/env node

/**
 * Archive helper: exchange a Last.fm token for a session and store it locally.
 * Usage: LASTFM_TOKEN=... node archive/setup-lastfm-auth.js
 *    or: node archive/setup-lastfm-auth.js <token>
 */

const LastFmAuth = require('../src/lastfm-auth');

async function setupLastFmAuth() {
    const token = process.env.LASTFM_TOKEN || process.argv[2];

    if (!token) {
        console.error('Missing Last.fm token.');
        console.error('Usage: LASTFM_TOKEN=<token> node archive/setup-lastfm-auth.js');
        console.error('   or: node archive/setup-lastfm-auth.js <token>');
        process.exit(1);
    }

    try {
        const lastfmAuth = new LastFmAuth();
        const session = await lastfmAuth.getSession(token);

        if (!session || !session.key) {
            console.error('Failed to get Last.fm session');
            process.exit(1);
        }

        console.log('Last.fm authentication successful');
        console.log(`Username: ${session.name}`);
    } catch (error) {
        console.error('Error setting up Last.fm authentication:', error.message);
        process.exit(1);
    }
}

setupLastFmAuth();
