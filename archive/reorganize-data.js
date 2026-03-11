#!/usr/bin/env node

/**
 * Reorganize data folder structure and clean up duplicate files
 * - Move playlists to data/spotify_playlists/ with proper naming
 * - Remove duplicate files
 * - Clean up old folder structure
 */

const fs = require('fs');
const path = require('path');

const rawDir = path.join(__dirname, 'data', 'raw');
const newPlaylistsDir = path.join(__dirname, 'data', 'spotify_playlists');
const explorerDir = path.join(__dirname, 'data', 'explorer');
const processedDir = path.join(__dirname, 'data', 'processed');

console.log('🧹 Reorganizing data folder structure...\n');

// Ensure new directories exist
fs.mkdirSync(newPlaylistsDir, { recursive: true });
fs.mkdirSync(path.join(__dirname, 'data', 'lastfm_cache'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'data', 'mappings'), { recursive: true });

// Process all_playlists_detailed.json
const allPlaylistsFile = path.join(rawDir, 'all_playlists_detailed.json');
if (fs.existsSync(allPlaylistsFile)) {
    console.log('Processing all_playlists_detailed.json...');
    const allPlaylists = JSON.parse(fs.readFileSync(allPlaylistsFile, 'utf8'));
    
    allPlaylists.forEach(playlist => {
        if (playlist.id && playlist.name) {
            const safeName = playlist.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toLowerCase();
            const filename = `${safeName}_${playlist.id}.json`;
            const filepath = path.join(newPlaylistsDir, filename);
            
            fs.writeFileSync(filepath, JSON.stringify(playlist, null, 2));
            console.log(`  Created: ${filename}`);
        }
    });
}

// Process individual playlist files
const playlistFiles = fs.readdirSync(rawDir).filter(file => 
    file.startsWith('playlist_') && file.endsWith('.json') && file !== 'all_playlists_detailed.json'
);

console.log(`\nProcessing ${playlistFiles.length} individual playlist files...`);

const processedPlaylists = new Set();

playlistFiles.forEach(file => {
    const filePath = path.join(rawDir, file);
    const playlist = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (playlist.id && playlist.name && !processedPlaylists.has(playlist.id)) {
        const safeName = playlist.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toLowerCase();
        const filename = `${safeName}_${playlist.id}.json`;
        const filepath = path.join(newPlaylistsDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(playlist, null, 2));
        console.log(`  Created: ${filename}`);
        processedPlaylists.add(playlist.id);
    } else {
        console.log(`  Skipped duplicate: ${file}`);
    }
});

// Clean up old directories
console.log('\n🧹 Cleaning up old directories...');

// Remove old raw directory
if (fs.existsSync(rawDir)) {
    fs.rmSync(rawDir, { recursive: true });
    console.log('  Removed: data/raw/');
}

// Remove old processed directory (keep mapping.db in new location)
if (fs.existsSync(processedDir)) {
    fs.rmSync(processedDir, { recursive: true });
    console.log('  Removed: data/processed/');
}

// Remove old explorer directory
if (fs.existsSync(explorerDir)) {
    fs.rmSync(explorerDir, { recursive: true });
    console.log('  Removed: data/explorer/');
}

// Create new structure summary
console.log('\n📁 New data structure:');
console.log('  data/');
console.log('  ├── spotify_playlists/     # All Spotify playlists with proper naming');
console.log('  ├── lastfm_cache/          # Cached Last.fm data (yearly expiration)');
console.log('  └── mappings/              # Database and mapping files');
console.log('      └── mapping.db         # Last.fm to Spotify mappings');

console.log(`\n✅ Reorganization complete!`);
console.log(`   Processed ${processedPlaylists.size} unique playlists`);
console.log(`   All files now use format: PLAYLIST_NAME_PLAYLIST_ID.json`);