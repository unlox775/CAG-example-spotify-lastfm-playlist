const DynamicDistribution = require('../../src/dynamic-distribution');

describe('Dynamic Distribution Algorithm', () => {
    describe('calculateDistribution', () => {
        test('should handle real-world 80s playlist scenario with clear major/minor split', () => {
            // Simulate a realistic 80s playlist with some dominant artists and many single-song artists
            const artistCounts = {
                'madonna': { name: 'Madonna', count: 25 },
                'michael_jackson': { name: 'Michael Jackson', count: 20 },
                'prince': { name: 'Prince', count: 15 },
                'duran_duran': { name: 'Duran Duran', count: 12 },
                'wham': { name: 'Wham!', count: 8 },
                'cyndi_lauper': { name: 'Cyndi Lauper', count: 6 },
                'billy_idol': { name: 'Billy Idol', count: 4 },
                'depeche_mode': { name: 'Depeche Mode', count: 3 },
                'tears_for_fears': { name: 'Tears for Fears', count: 2 },
                'a_ha': { name: 'a-ha', count: 1 },
                'spandau_ballet': { name: 'Spandau Ballet', count: 1 },
                'the_police': { name: 'The Police', count: 1 },
                'eurythmics': { name: 'Eurythmics', count: 1 },
                'culture_club': { name: 'Culture Club', count: 1 },
                'david_bowie': { name: 'David Bowie', count: 1 }
            };

            const result = DynamicDistribution.calculateDistribution(artistCounts);

            // Business value: Should identify the top 50% of distinct counts as major artists
            // Distinct counts: 25, 20, 15, 12, 8, 6, 4, 3, 2, 1 (10 total)
            // Top 50% = top 5: 25, 20, 15, 12, 8
            // Threshold should be 8
            expect(result.threshold).toBe(8);
            expect(result.majorArtists).toHaveLength(5);
            expect(result.minorArtists).toHaveLength(10);

            // Business value: Major artists should get 5 songs each for full exploration
            expect(result.distribution['madonna']).toBe(5);
            expect(result.distribution['michael_jackson']).toBe(5);
            expect(result.distribution['prince']).toBe(5);
            expect(result.distribution['duran_duran']).toBe(5);
            expect(result.distribution['wham']).toBe(5);

            // Business value: Minor artists should get 1-4 songs proportionally
            // This ensures single-song artists don't dominate but still get representation
            const minorArtistSongs = result.minorArtists.map(artist => result.distribution[artist.id]);
            minorArtistSongs.forEach(songCount => {
                expect(songCount).toBeGreaterThanOrEqual(1);
                expect(songCount).toBeLessThanOrEqual(4);
            });

            // Business value: Total should be reasonable (around 50)
            const totalSongs = Object.values(result.distribution).reduce((sum, count) => sum + count, 0);
            expect(totalSongs).toBeGreaterThan(40);
            expect(totalSongs).toBeLessThan(60);
        });

        test('should handle folk playlist scenario with few dominant artists', () => {
            // Simulate Dave's Folk playlist scenario
            const artistCounts = {
                'james_taylor': { name: 'James Taylor', count: 23 },
                'john_denver': { name: 'John Denver', count: 21 },
                'simon_garfunkel': { name: 'Simon & Garfunkel', count: 19 },
                'yusuf_cat_stevens': { name: 'Yusuf / Cat Stevens', count: 3 },
                'carole_king': { name: 'Carole King', count: 2 },
                'don_mclean': { name: 'Don McLean', count: 2 },
                'joni_mitchell': { name: 'Joni Mitchell', count: 2 },
                'jim_croce': { name: 'Jim Croce', count: 2 },
                'gordon_lightfoot': { name: 'Gordon Lightfoot', count: 1 },
                'paul_simon': { name: 'Paul Simon', count: 1 },
                'mike_taylor': { name: 'Mike Taylor', count: 1 },
                'loggins_messina': { name: 'Loggins & Messina', count: 1 },
                'seals_crofts': { name: 'Seals and Crofts', count: 1 },
                'bread': { name: 'Bread', count: 1 }
            };

            const result = DynamicDistribution.calculateDistribution(artistCounts);

            // Business value: Should identify the 3 major artists correctly
            expect(result.threshold).toBe(19);
            expect(result.majorArtists).toHaveLength(3);
            expect(result.minorArtists).toHaveLength(11);

            // Business value: Major artists get full exploration (5 songs each)
            expect(result.distribution['james_taylor']).toBe(5);
            expect(result.distribution['john_denver']).toBe(5);
            expect(result.distribution['simon_garfunkel']).toBe(5);

            // Business value: Minor artists get proportional representation
            // Artists with 3 songs should get more than artists with 1 song
            expect(result.distribution['yusuf_cat_stevens']).toBeGreaterThan(result.distribution['gordon_lightfoot']);
            expect(result.distribution['yusuf_cat_stevens']).toBeGreaterThan(result.distribution['paul_simon']);
        });

        test('should handle edge case with many single-song artists', () => {
            // Business value: Prevents single-song artists from dominating the playlist
            const artistCounts = {};
            for (let i = 1; i <= 50; i++) {
                artistCounts[`artist_${i}`] = { name: `Artist ${i}`, count: 1 };
            }
            // Add a few major artists
            artistCounts['major1'] = { name: 'Major Artist 1', count: 10 };
            artistCounts['major2'] = { name: 'Major Artist 2', count: 8 };

            const result = DynamicDistribution.calculateDistribution(artistCounts);

            // Business value: Should identify the major artists correctly despite many single-song artists
            expect(result.threshold).toBe(8);
            expect(result.majorArtists).toHaveLength(2);
            expect(result.minorArtists).toHaveLength(50);

            // Business value: Major artists get full exploration
            expect(result.distribution['major1']).toBe(5);
            expect(result.distribution['major2']).toBe(5);

            // Business value: Single-song artists get minimal representation (1 song each)
            for (let i = 1; i <= 50; i++) {
                expect(result.distribution[`artist_${i}`]).toBe(1);
            }
        });

        test('should handle all artists having same count', () => {
            // Business value: When all artists are equally represented, all should get equal treatment
            const artistCounts = {
                'artist1': { name: 'Artist 1', count: 5 },
                'artist2': { name: 'Artist 2', count: 5 },
                'artist3': { name: 'Artist 3', count: 5 },
                'artist4': { name: 'Artist 4', count: 5 }
            };

            const result = DynamicDistribution.calculateDistribution(artistCounts);

            // Business value: All artists should be treated as major (get 5 songs each)
            expect(result.threshold).toBe(5);
            expect(result.majorArtists).toHaveLength(4);
            expect(result.minorArtists).toHaveLength(0);

            // All artists get equal representation
            expect(result.distribution['artist1']).toBe(5);
            expect(result.distribution['artist2']).toBe(5);
            expect(result.distribution['artist3']).toBe(5);
            expect(result.distribution['artist4']).toBe(5);
        });

        test('should handle empty input gracefully', () => {
            // Business value: Should not crash on empty input
            const result = DynamicDistribution.calculateDistribution({});

            expect(result.distribution).toEqual({});
            expect(result.threshold).toBe(0);
            expect(result.majorArtists).toEqual([]);
            expect(result.minorArtists).toEqual([]);
        });

        test('should handle single artist', () => {
            // Business value: Single artist should get full exploration
            const artistCounts = {
                'single_artist': { name: 'Single Artist', count: 10 }
            };

            const result = DynamicDistribution.calculateDistribution(artistCounts);

            expect(result.threshold).toBe(10);
            expect(result.majorArtists).toHaveLength(1);
            expect(result.minorArtists).toHaveLength(0);
            expect(result.distribution['single_artist']).toBe(5);
        });

        test('should handle odd number of distinct counts correctly', () => {
            // Business value: 50% calculation should work correctly with odd numbers
            const artistCounts = {
                'a1': { name: 'A1', count: 5 },
                'a2': { name: 'A2', count: 3 },
                'a3': { name: 'A3', count: 1 }
            };

            const result = DynamicDistribution.calculateDistribution(artistCounts);

            // 3 distinct counts: 5, 3, 1
            // Top 50% = top 2: 5, 3 (Math.ceil(3 * 0.5) = 2)
            expect(result.threshold).toBe(3);
            expect(result.majorArtists).toHaveLength(2);
            expect(result.minorArtists).toHaveLength(1);
        });
    });

    describe('getDistributionSummary', () => {
        test('should generate readable summary for business stakeholders', () => {
            const artistCounts = {
                'major1': { name: 'Major Artist 1', count: 20 },
                'major2': { name: 'Major Artist 2', count: 15 },
                'minor1': { name: 'Minor Artist 1', count: 3 },
                'minor2': { name: 'Minor Artist 2', count: 1 }
            };

            const result = DynamicDistribution.calculateDistribution(artistCounts);
            const summary = DynamicDistribution.getDistributionSummary(result);

            // Business value: Summary should be human-readable and informative
            expect(summary).toContain('Dynamic Distribution Summary');
            expect(summary).toContain('Threshold (50% line): 15 songs');
            expect(summary).toContain('Major artists (≥15 songs): 2');
            expect(summary).toContain('Minor artists (<15 songs): 2');
            expect(summary).toContain('Major Artist 1: 20 in source → 5 in explorer');
            expect(summary).toContain('Minor Artist 1: 3 in source → 4 in explorer');
            expect(summary).toContain('Total target songs:');
        });
    });

    describe('Business Logic Validation', () => {
        test('should ensure proportional distribution maintains artist hierarchy', () => {
            // Business value: Artists with more songs in source should get more songs in explorer
            const artistCounts = {
                'high': { name: 'High Count Artist', count: 10 },
                'medium': { name: 'Medium Count Artist', count: 5 },
                'low': { name: 'Low Count Artist', count: 2 },
                'single': { name: 'Single Song Artist', count: 1 }
            };

            const result = DynamicDistribution.calculateDistribution(artistCounts);

            // Business value: Hierarchy should be maintained
            expect(result.distribution['high']).toBeGreaterThanOrEqual(result.distribution['medium']);
            expect(result.distribution['medium']).toBeGreaterThanOrEqual(result.distribution['low']);
            expect(result.distribution['low']).toBeGreaterThanOrEqual(result.distribution['single']);
        });

        test('should prevent single-song artist domination', () => {
            // Business value: Many single-song artists shouldn't overwhelm the playlist
            const artistCounts = {};
            
            // Add 30 single-song artists
            for (let i = 1; i <= 30; i++) {
                artistCounts[`single_${i}`] = { name: `Single ${i}`, count: 1 };
            }
            
            // Add 2 major artists
            artistCounts['major1'] = { name: 'Major 1', count: 20 };
            artistCounts['major2'] = { name: 'Major 2', count: 15 };

            const result = DynamicDistribution.calculateDistribution(artistCounts);

            // Business value: Major artists should still get full exploration
            expect(result.distribution['major1']).toBe(5);
            expect(result.distribution['major2']).toBe(5);

            // Business value: Single-song artists should get minimal representation
            const singleArtistSongs = Array.from({length: 30}, (_, i) => result.distribution[`single_${i + 1}`]);
            singleArtistSongs.forEach(songCount => {
                expect(songCount).toBe(1);
            });

            // Business value: Total should be reasonable, not dominated by single-song artists
            const totalSongs = Object.values(result.distribution).reduce((sum, count) => sum + count, 0);
            expect(totalSongs).toBeLessThan(50); // Should be much less than 30 + 10
        });
    });
});