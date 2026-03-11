/**
 * Dynamic Playlist Distribution Algorithm
 * 
 * This module implements a sophisticated distribution algorithm that:
 * 1. Gets all unique song counts per artist (ignoring how many artists have each count)
 * 2. Takes the top 70% of those distinct counts
 * 3. Sets that as the threshold for "major" vs "minor" artists
 * 4. Major artists get 5 songs each
 * 5. Minor artists get 1-4 songs proportionally (never less than 1)
 */

class DynamicDistribution {
    /**
     * Calculate dynamic song distribution for artists based on their song counts
     * 
     * @param {Object} artistCounts - Object with artist IDs as keys and {name, count} as values
     * @returns {Object} - Object with artist IDs as keys and target song counts as values
     */
    static calculateDistribution(artistCounts) {
        if (!artistCounts || Object.keys(artistCounts).length === 0) {
            return {
                distribution: {},
                threshold: 0,
                uniqueCounts: [],
                top70PercentCounts: [],
                majorArtists: [],
                minorArtists: []
            };
        }

        // Step 1: Get all unique song counts (distinct values only)
        const uniqueCounts = [...new Set(Object.values(artistCounts).map(artist => artist.count))];
        uniqueCounts.sort((a, b) => b - a); // Sort descending (highest first)

        // Step 2: Take top 70% of distinct counts
        const top70PercentIndex = Math.ceil(uniqueCounts.length * 0.7);
        const top70PercentCounts = uniqueCounts.slice(0, top70PercentIndex);
        
        // Step 3: The threshold is the lowest count in the top 70%
        const threshold = top70PercentCounts[top70PercentCounts.length - 1];

        // Step 4: Calculate distribution
        const distribution = {};
        const majorArtists = [];
        const minorArtists = [];

        // Separate artists into major and minor
        for (const [artistId, artistData] of Object.entries(artistCounts)) {
            if (artistData.count >= threshold) {
                majorArtists.push({ id: artistId, ...artistData });
                distribution[artistId] = 5; // Major artists get 5 songs
            } else {
                minorArtists.push({ id: artistId, ...artistData });
            }
        }

        // Step 5: Distribute songs among minor artists (1-4 songs each)
        if (minorArtists.length > 0) {
            // Calculate total songs available for minor artists
            const totalSongs = 50; // Target total
            const majorArtistSongs = majorArtists.length * 5;
            const availableForMinor = Math.max(0, totalSongs - majorArtistSongs);

            if (availableForMinor > 0) {
                // Sort minor artists by count (descending)
                minorArtists.sort((a, b) => b.count - a.count);

                // Distribute proportionally among minor artists
                const totalMinorCount = minorArtists.reduce((sum, artist) => sum + artist.count, 0);
                
                for (const artist of minorArtists) {
                    // Calculate proportional share (minimum 1, maximum 4)
                    const proportionalShare = Math.round((artist.count / totalMinorCount) * availableForMinor);
                    const targetSongs = Math.max(1, Math.min(4, proportionalShare));
                    distribution[artist.id] = targetSongs;
                }
            } else {
                // If no songs available for minor artists, give them 1 each
                for (const artist of minorArtists) {
                    distribution[artist.id] = 1;
                }
            }
        }

        return {
            distribution,
            threshold,
            uniqueCounts,
            top70PercentCounts,
            majorArtists: majorArtists.map(a => ({ id: a.id, name: a.name, count: a.count })),
            minorArtists: minorArtists.map(a => ({ id: a.id, name: a.name, count: a.count }))
        };
    }

    /**
     * Get a summary of the distribution for logging/debugging
     * 
     * @param {Object} result - Result from calculateDistribution
     * @returns {string} - Human-readable summary
     */
    static getDistributionSummary(result) {
        const { distribution, threshold, majorArtists, minorArtists } = result;
        
        let summary = `Dynamic Distribution Summary:\n`;
        summary += `Threshold (70% line): ${threshold} songs\n`;
        summary += `Major artists (≥${threshold} songs): ${majorArtists.length}\n`;
        summary += `Minor artists (<${threshold} songs): ${minorArtists.length}\n\n`;
        
        summary += `Major Artists (5 songs each):\n`;
        majorArtists.forEach(artist => {
            summary += `  ${artist.name}: ${artist.count} in source → 5 in explorer\n`;
        });
        
        summary += `\nMinor Artists (1-4 songs each):\n`;
        minorArtists.forEach(artist => {
            const targetSongs = distribution[artist.id];
            summary += `  ${artist.name}: ${artist.count} in source → ${targetSongs} in explorer\n`;
        });
        
        const totalSongs = Object.values(distribution).reduce((sum, count) => sum + count, 0);
        summary += `\nTotal target songs: ${totalSongs}`;
        
        return summary;
    }
}

module.exports = DynamicDistribution;