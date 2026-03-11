#!/usr/bin/env node

/**
 * Filter cached Spotify data to only include essential fields
 * This reduces file sizes by ~90% by removing unused metadata
 */

const fs = require('fs');
const path = require('path');

const rawDir = path.join(__dirname, 'data', 'raw');

console.log('🔧 Filtering cached Spotify data to essential fields only...\n');

function filterTrack(track) {
    if (!track || !track.id) return null;
    
    return {
        id: track.id,
        name: track.name,
        uri: track.uri,
        artists: track.artists ? track.artists.map(artist => ({
            id: artist.id,
            name: artist.name
        })) : [],
        album: track.album ? {
            id: track.album.id,
            name: track.album.name,
            album_type: track.album.album_type
        } : null
    };
}

function filterPlaylist(playlist) {
    return {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description || '',
        tracks: playlist.tracks ? playlist.tracks.map(trackData => ({
            added_at: trackData.added_at,
            added_by: {
                id: trackData.added_by?.id,
                display_name: trackData.added_by?.display_name
            },
            track: filterTrack(trackData.track)
        })).filter(trackData => trackData.track !== null) : []
    };
}

// Process all_playlists_detailed.json
const allPlaylistsFile = path.join(rawDir, 'all_playlists_detailed.json');
if (fs.existsSync(allPlaylistsFile)) {
    console.log('Processing all_playlists_detailed.json...');
    const allPlaylists = JSON.parse(fs.readFileSync(allPlaylistsFile, 'utf8'));
    
    const originalSize = fs.statSync(allPlaylistsFile).size;
    const originalLines = allPlaylists.reduce((acc, playlist) => {
        return acc + JSON.stringify(playlist).split('\n').length;
    }, 0);
    
    const filteredPlaylists = allPlaylists.map(filterPlaylist);
    
    fs.writeFileSync(allPlaylistsFile, JSON.stringify(filteredPlaylists, null, 2));
    
    const newSize = fs.statSync(allPlaylistsFile).size;
    const newLines = JSON.stringify(filteredPlaylists, null, 2).split('\n').length;
    
    console.log(`  Original: ${Math.round(originalSize / (1024 * 1024) * 100) / 100}MB (${originalLines.toLocaleString()} lines)`);
    console.log(`  Filtered: ${Math.round(newSize / (1024 * 1024) * 100) / 100}MB (${newLines.toLocaleString()} lines)`);
    console.log(`  Reduction: ${Math.round((1 - newSize / originalSize) * 100)}%`);
}

// Process individual playlist files
const playlistFiles = fs.readdirSync(rawDir).filter(file => 
    file.startsWith('playlist_') && file.endsWith('.json')
);

console.log(`\nProcessing ${playlistFiles.length} individual playlist files...`);

let totalOriginalSize = 0;
let totalNewSize = 0;
let totalOriginalLines = 0;
let totalNewLines = 0;

playlistFiles.forEach(file => {
    const filePath = path.join(rawDir, file);
    const playlist = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const originalSize = fs.statSync(filePath).size;
    const originalLines = JSON.stringify(playlist).split('\n').length;
    
    const filteredPlaylist = filterPlaylist(playlist);
    
    fs.writeFileSync(filePath, JSON.stringify(filteredPlaylist, null, 2));
    
    const newSize = fs.statSync(filePath).size;
    const newLines = JSON.stringify(filteredPlaylist, null, 2).split('\n').length;
    
    totalOriginalSize += originalSize;
    totalNewSize += newSize;
    totalOriginalLines += originalLines;
    totalNewLines += newLines;
    
    if (originalSize > 1024 * 1024) { // Only show files > 1MB
        console.log(`  ${file}: ${Math.round(originalSize / (1024 * 1024) * 100) / 100}MB → ${Math.round(newSize / (1024 * 1024) * 100) / 100}MB (${Math.round((1 - newSize / originalSize) * 100)}% reduction)`);
    }
});

console.log(`\n📊 Summary:`);
console.log(`  Total original size: ${Math.round(totalOriginalSize / (1024 * 1024) * 100) / 100}MB`);
console.log(`  Total filtered size: ${Math.round(totalNewSize / (1024 * 1024) * 100) / 100}MB`);
console.log(`  Total reduction: ${Math.round((1 - totalNewSize / totalOriginalSize) * 100)}%`);
console.log(`  Original lines: ${totalOriginalLines.toLocaleString()}`);
console.log(`  Filtered lines: ${totalNewLines.toLocaleString()}`);
console.log(`  Line reduction: ${Math.round((1 - totalNewLines / totalOriginalLines) * 100)}%`);

console.log(`\n✅ Data filtering complete!`);
console.log(`\n📋 Next steps:`);
console.log(`  1. Run: make update-lastfm-explorer-playlist PLAYLIST_NAME="Dave's Folk"`);
console.log(`  2. The system will now work with much smaller, essential-only data files.`);