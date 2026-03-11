#!/usr/bin/env node

/**
 * Cleanup script to remove massive cached files and re-sync with filtered data
 * This will reduce file sizes by ~90% by removing unused Spotify metadata
 */

const fs = require('fs');
const path = require('path');

const rawDir = path.join(__dirname, 'data', 'raw');
const processedDir = path.join(__dirname, 'data', 'processed');

console.log('🧹 Starting cleanup of massive cached files...\n');

// Find all JSON files in raw directory
const files = fs.readdirSync(rawDir).filter(file => file.endsWith('.json'));

console.log(`Found ${files.length} JSON files to analyze:`);

let totalSizeBefore = 0;
let totalLinesBefore = 0;
const largeFiles = [];

files.forEach(file => {
    const filePath = path.join(rawDir, file);
    const stats = fs.statSync(filePath);
    const sizeKB = Math.round(stats.size / 1024);
    const sizeMB = Math.round(stats.size / (1024 * 1024) * 100) / 100;
    
    // Count lines
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;
    
    totalSizeBefore += stats.size;
    totalLinesBefore += lines;
    
    if (stats.size > 1024 * 1024) { // Files larger than 1MB
        largeFiles.push({
            name: file,
            size: stats.size,
            sizeMB: sizeMB,
            lines: lines
        });
    }
    
    console.log(`  ${file}: ${sizeMB}MB (${lines.toLocaleString()} lines)`);
});

console.log(`\n📊 Summary:`);
console.log(`  Total files: ${files.length}`);
console.log(`  Large files (>1MB): ${largeFiles.length}`);
console.log(`  Total size: ${Math.round(totalSizeBefore / (1024 * 1024) * 100) / 100}MB`);
console.log(`  Total lines: ${totalLinesBefore.toLocaleString()}`);

if (largeFiles.length > 0) {
    console.log(`\n🗑️  Large files to be removed:`);
    largeFiles.forEach(file => {
        console.log(`  - ${file.name}: ${file.sizeMB}MB (${file.lines.toLocaleString()} lines)`);
    });
}

console.log(`\n⚠️  This will remove all cached data and require a full re-sync.`);
console.log(`   The new sync will use filtered data (90% smaller files).`);
console.log(`\nProceeding in 5 seconds... (Ctrl+C to cancel)`);

setTimeout(() => {
    console.log(`\n🗑️  Removing cached files...`);
    
    // Remove all JSON files in raw directory
    files.forEach(file => {
        const filePath = path.join(rawDir, file);
        fs.unlinkSync(filePath);
        console.log(`  Removed: ${file}`);
    });
    
    // Remove processed files that depend on raw data
    const processedFiles = fs.readdirSync(processedDir).filter(file => file.endsWith('.json'));
    processedFiles.forEach(file => {
        const filePath = path.join(processedDir, file);
        fs.unlinkSync(filePath);
        console.log(`  Removed: ${file}`);
    });
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`\n📋 Next steps:`);
    console.log(`  1. Run: make sync-playlists`);
    console.log(`  2. Run: make update-lastfm-explorer-playlist PLAYLIST_NAME="Dave's Folk"`);
    console.log(`\n   The new files will be ~90% smaller with only essential data.`);
    
}, 5000);