#!/usr/bin/env node

const fs = require('fs');

console.log('Spotify Last.fm CAG Example - Local Smoke Check');
console.log('==============================================');

const requiredFiles = [
    'src/auth.js',
    'src/lastfm-auth.js',
    'src/playlist-manager.js',
    'src/fuzzy-matcher.js',
    'src/mapping-db.js',
    'src/cli.js',
    'Makefile',
    'README.md',
    '.env.example'
];

let ok = true;

console.log('\n1) File checks');
for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
        console.log(`   OK ${file}`);
    } else {
        console.log(`   MISSING ${file}`);
        ok = false;
    }
}

console.log('\n2) Module load checks');
try {
    require('./src/auth');
    require('./src/lastfm-auth');
    require('./src/playlist-manager');
    require('./src/fuzzy-matcher');
    require('./src/mapping-db');
    console.log('   OK core modules loaded');
} catch (error) {
    console.log(`   FAIL module load: ${error.message}`);
    ok = false;
}

console.log('\n3) Environment hints');
const requiredEnv = [
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_SECRET_ID',
    'LASTFM_API_KEY',
    'LASTFM_SHARED_SECRET (or LASTFM_SECRET)'
];
requiredEnv.forEach((item) => console.log(`   - ${item}`));

if (!ok) {
    console.log('\nSmoke check failed. Fix missing files/modules before running the playlist flow.');
    process.exit(1);
}

console.log('\nSmoke check passed.');
console.log('Next: set env vars, run auth commands, then run make sync-spotify-playlists.');
