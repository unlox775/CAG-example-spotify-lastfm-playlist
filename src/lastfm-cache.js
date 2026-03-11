const fs = require('fs');
const path = require('path');

class LastFmCache {
    constructor() {
        this.cacheDir = path.join(__dirname, '..', 'data', 'lastfm_cache');
        this.cacheExpiry = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
        
        // Ensure cache directory exists
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    /**
     * Get cache file path for an artist
     */
    getCacheFilePath(artist) {
        const safeArtist = artist.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        return path.join(this.cacheDir, `${safeArtist}_toptracks.json`);
    }

    /**
     * Check if cache exists and is still valid
     */
    isCacheValid(artist) {
        const cacheFile = this.getCacheFilePath(artist);
        
        if (!fs.existsSync(cacheFile)) {
            return false;
        }

        try {
            const stats = fs.statSync(cacheFile);
            const now = new Date().getTime();
            const cacheTime = stats.mtime.getTime();
            
            return (now - cacheTime) < this.cacheExpiry;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get cached data for an artist
     */
    getCachedData(artist) {
        const cacheFile = this.getCacheFilePath(artist);
        
        if (!this.isCacheValid(artist)) {
            return null;
        }

        try {
            const data = fs.readFileSync(cacheFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.warn(`Failed to read cache for ${artist}:`, error.message);
            return null;
        }
    }

    /**
     * Cache data for an artist
     */
    cacheData(artist, data) {
        const cacheFile = this.getCacheFilePath(artist);
        
        try {
            // Filter data to only include essential fields
            const filteredData = {
                artist: data.artist,
                toptracks: data.toptracks ? data.toptracks.track.map(track => ({
                    name: track.name,
                    playcount: track.playcount,
                    listeners: track.listeners,
                    mbid: track.mbid,
                    url: track.url,
                    streamable: track.streamable,
                    artist: track.artist ? {
                        name: track.artist.name,
                        mbid: track.artist.mbid,
                        url: track.artist.url
                    } : null
                })) : [],
                cached_at: new Date().toISOString()
            };
            
            fs.writeFileSync(cacheFile, JSON.stringify(filteredData, null, 2));
            return true;
        } catch (error) {
            console.error(`Failed to cache data for ${artist}:`, error.message);
            return false;
        }
    }

    /**
     * Clear cache for an artist
     */
    clearCache(artist) {
        const cacheFile = this.getCacheFilePath(artist);
        
        if (fs.existsSync(cacheFile)) {
            try {
                fs.unlinkSync(cacheFile);
                return true;
            } catch (error) {
                console.error(`Failed to clear cache for ${artist}:`, error.message);
                return false;
            }
        }
        
        return true;
    }

    /**
     * Clear all cache
     */
    clearAllCache() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    fs.unlinkSync(path.join(this.cacheDir, file));
                }
            });
            return true;
        } catch (error) {
            console.error('Failed to clear all cache:', error.message);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            let totalSize = 0;
            let validCaches = 0;
            let expiredCaches = 0;
            
            jsonFiles.forEach(file => {
                const filePath = path.join(this.cacheDir, file);
                const stats = fs.statSync(filePath);
                totalSize += stats.size;
                
                const artist = file.replace('_toptracks.json', '').replace(/_/g, ' ');
                if (this.isCacheValid(artist)) {
                    validCaches++;
                } else {
                    expiredCaches++;
                }
            });
            
            return {
                totalFiles: jsonFiles.length,
                validCaches,
                expiredCaches,
                totalSizeBytes: totalSize,
                totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
            };
        } catch (error) {
            console.error('Failed to get cache stats:', error.message);
            return null;
        }
    }
}

module.exports = LastFmCache;