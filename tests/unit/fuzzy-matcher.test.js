const FuzzyMatcher = require('../../src/fuzzy-matcher');

// Mock SpotifyAPI
jest.mock('../../src/spotify-api');

describe('FuzzyMatcher', () => {
    let fuzzyMatcher;
    let mockSpotifyAPI;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockSpotifyAPI = {
            searchTracks: jest.fn(),
            searchArtists: jest.fn()
        };
        
        require('../../src/spotify-api').mockImplementation(() => mockSpotifyAPI);
        fuzzyMatcher = new FuzzyMatcher();
    });

    describe('searchTrack', () => {
        test('should find exact track matches', async () => {
            // Business value: Ensures exact matches are found for reliable track mapping
            const trackName = 'Fire and Rain';
            const artistName = 'James Taylor';
            
            const mockSpotifyTracks = [
                {
                    id: 'track1',
                    name: 'Fire and Rain',
                    artists: [{ name: 'James Taylor' }],
                    popularity: 80
                },
                {
                    id: 'track2',
                    name: 'Fire and Rain - Live',
                    artists: [{ name: 'James Taylor' }],
                    popularity: 70
                }
            ];

            mockSpotifyAPI.searchTracks.mockResolvedValue(mockSpotifyTracks);

            const result = await fuzzyMatcher.searchTrack(trackName, artistName);

            // Business value: Should return the best match
            expect(result).toBeDefined();
            expect(result.id).toBe('track1');
            expect(result.name).toBe('Fire and Rain');
            expect(result.artists[0].name).toBe('James Taylor');
        });

        test('should handle fuzzy matches with similarity scoring', async () => {
            // Business value: Should find close matches when exact matches aren't available
            const trackName = 'Carolina in My Mind';
            const artistName = 'James Taylor';
            
            const mockSpotifyTracks = [
                {
                    id: 'track1',
                    name: 'Carolina in My Mind',
                    artists: [{ name: 'James Taylor' }],
                    popularity: 80
                },
                {
                    id: 'track2',
                    name: 'Carolina in My Mind - 2019 Remaster',
                    artists: [{ name: 'James Taylor' }],
                    popularity: 75
                },
                {
                    id: 'track3',
                    name: 'Carolina',
                    artists: [{ name: 'James Taylor' }],
                    popularity: 60
                }
            ];

            mockSpotifyAPI.searchTracks.mockResolvedValue(mockSpotifyTracks);

            const result = await fuzzyMatcher.searchTrack(trackName, artistName);

            // Business value: Should return the best match based on similarity and popularity
            expect(result).toBeDefined();
            expect(result.name).toContain('Carolina in My Mind');
        });

        test('should handle no matches gracefully', async () => {
            // Business value: Should not crash when no matches are found
            const trackName = 'Non-existent Song';
            const artistName = 'Unknown Artist';
            
            mockSpotifyAPI.searchTracks.mockResolvedValue([]);

            const result = await fuzzyMatcher.searchTrack(trackName, artistName);

            // Business value: Should return null when no matches found
            expect(result).toBeNull();
        });

        test('should handle API errors gracefully', async () => {
            // Business value: Should handle API failures without crashing
            const trackName = 'Test Song';
            const artistName = 'Test Artist';
            
            mockSpotifyAPI.searchTracks.mockRejectedValue(new Error('API Error'));

            await expect(fuzzyMatcher.searchTrack(trackName, artistName))
                .rejects.toThrow('API Error');
        });
    });

    describe('searchArtist', () => {
        test('should find exact artist matches', async () => {
            // Business value: Ensures artist mapping works for playlist generation
            const artistName = 'James Taylor';
            
            const mockSpotifyArtists = [
                {
                    id: 'artist1',
                    name: 'James Taylor',
                    popularity: 80
                },
                {
                    id: 'artist2',
                    name: 'James Taylor & Carole King',
                    popularity: 70
                }
            ];

            mockSpotifyAPI.searchArtists.mockResolvedValue(mockSpotifyArtists);

            const result = await fuzzyMatcher.searchArtist(artistName);

            // Business value: Should return the best match
            expect(result).toBeDefined();
            expect(result.id).toBe('artist1');
            expect(result.name).toBe('James Taylor');
            expect(result.similarity_score).toBeGreaterThan(0.9);
        });

        test('should handle fuzzy artist matches', async () => {
            // Business value: Should find close artist matches for better coverage
            const artistName = 'Simon & Garfunkel';
            
            const mockSpotifyArtists = [
                {
                    id: 'artist1',
                    name: 'Simon & Garfunkel',
                    popularity: 85
                },
                {
                    id: 'artist2',
                    name: 'Simon and Garfunkel',
                    popularity: 80
                },
                {
                    id: 'artist3',
                    name: 'Paul Simon',
                    popularity: 75
                }
            ];

            mockSpotifyAPI.searchArtists.mockResolvedValue(mockSpotifyArtists);

            const result = await fuzzyMatcher.searchArtist(artistName);

            // Business value: Should return the best match
            expect(result).toBeDefined();
            expect(result.name).toContain('Simon');
            expect(result.similarity_score).toBeGreaterThan(0.8);
        });

        test('should handle no artist matches', async () => {
            // Business value: Should handle missing artists gracefully
            const artistName = 'Unknown Artist';
            
            mockSpotifyAPI.searchArtists.mockResolvedValue([]);

            const result = await fuzzyMatcher.searchArtist(artistName);

            // Business value: Should return null when no matches found
            expect(result).toBeNull();
        });
    });

    describe('Business Logic Validation', () => {
        test('should prioritize exact matches over fuzzy matches', async () => {
            // Business value: Exact matches should be preferred for accuracy
            const trackName = 'Fire and Rain';
            const artistName = 'James Taylor';
            
            const mockSpotifyTracks = [
                {
                    id: 'track1',
                    name: 'Fire and Rain - Live Version',
                    artists: [{ name: 'James Taylor' }],
                    popularity: 90
                },
                {
                    id: 'track2',
                    name: 'Fire and Rain',
                    artists: [{ name: 'James Taylor' }],
                    popularity: 80
                }
            ];

            mockSpotifyAPI.searchTracks.mockResolvedValue(mockSpotifyTracks);

            const result = await fuzzyMatcher.searchTrack(trackName, artistName);

            // Business value: Should prefer exact match over higher popularity
            expect(result.name).toBe('Fire and Rain');
        });

        test('should handle special characters in track names', async () => {
            // Business value: Should handle real-world track names with special characters
            const trackName = 'You\'ve Got a Friend';
            const artistName = 'James Taylor';
            
            const mockSpotifyTracks = [
                {
                    id: 'track1',
                    name: 'You\'ve Got a Friend',
                    artists: [{ name: 'James Taylor' }],
                    popularity: 80
                },
                {
                    id: 'track2',
                    name: 'You Have Got a Friend',
                    artists: [{ name: 'James Taylor' }],
                    popularity: 70
                }
            ];

            mockSpotifyAPI.searchTracks.mockResolvedValue(mockSpotifyTracks);

            const result = await fuzzyMatcher.searchTrack(trackName, artistName);

            // Business value: Should handle apostrophes correctly
            expect(result).toBeDefined();
            expect(result.name).toContain('You');
        });

        test('should handle multiple artists in track', async () => {
            // Business value: Should work with tracks that have multiple artists
            const trackName = 'Something';
            const artistName = 'James Taylor';
            
            const mockSpotifyTracks = [
                {
                    id: 'track1',
                    name: 'Something',
                    artists: [
                        { name: 'James Taylor' },
                        { name: 'Carole King' }
                    ],
                    popularity: 80
                }
            ];

            mockSpotifyAPI.searchTracks.mockResolvedValue(mockSpotifyTracks);

            const result = await fuzzyMatcher.searchTrack(trackName, artistName);

            // Business value: Should work with multi-artist tracks
            expect(result).toBeDefined();
            expect(result.artists).toHaveLength(2);
            expect(result.artists[0].name).toBe('James Taylor');
        });
    });
});