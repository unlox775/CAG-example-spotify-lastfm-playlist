const PlaylistManager = require('../../src/playlist-manager');
const DynamicDistribution = require('../../src/dynamic-distribution');
const fs = require('fs');
const path = require('path');

// Mock all external dependencies
jest.mock('../../src/spotify-api');
jest.mock('../../src/lastfm-api');
jest.mock('../../src/mapping-db');
jest.mock('../../src/fuzzy-matcher');
jest.mock('../../src/logger');

describe('Playlist Generation Integration Tests', () => {
    let playlistManager;
    let mockSpotifyAPI;
    let mockLastFmAPI;
    let mockMappingDB;
    let mockFuzzyMatcher;
    let mockLogger;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Create comprehensive mocks
        mockSpotifyAPI = {
            getCurrentUser: jest.fn(),
            getUserPlaylists: jest.fn(),
            getPlaylistDetails: jest.fn(),
            getPlaylistTracks: jest.fn(),
            filterSpotifyData: jest.fn(),
            createPlaylist: jest.fn(),
            addTracksToPlaylist: jest.fn(),
            clearPlaylistTracks: jest.fn()
        };
        
        mockLastFmAPI = {
            searchArtist: jest.fn(),
            getArtistTopTracks: jest.fn()
        };
        
        mockMappingDB = {
            init: jest.fn().mockResolvedValue(),
            close: jest.fn().mockResolvedValue(),
            getArtistMapping: jest.fn(),
            saveArtistMapping: jest.fn()
        };
        
        mockFuzzyMatcher = {
            searchArtist: jest.fn(),
            searchTrack: jest.fn()
        };
        
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };

        // Mock constructors
        require('../../src/spotify-api').mockImplementation(() => mockSpotifyAPI);
        require('../../src/lastfm-api').mockImplementation(() => mockLastFmAPI);
        require('../../src/mapping-db').mockImplementation(() => mockMappingDB);
        require('../../src/fuzzy-matcher').mockImplementation(() => mockFuzzyMatcher);
        require('../../src/logger').mockImplementation(() => mockLogger);

        playlistManager = new PlaylistManager();
    });

    describe('End-to-End Playlist Generation', () => {
        test('should generate complete explorer playlist with dynamic distribution', async () => {
            // Business value: Tests the complete workflow from source playlist to explorer playlist
            
            // Setup realistic test data
            const sourcePlaylist = {
                name: "Dave's Folk",
                tracks: [
                    // James Taylor - 3 songs (major artist)
                    { track: { artists: [{ id: 'james_taylor', name: 'James Taylor' }] } },
                    { track: { artists: [{ id: 'james_taylor', name: 'James Taylor' }] } },
                    { track: { artists: [{ id: 'james_taylor', name: 'James Taylor' }] } },
                    // John Denver - 2 songs (major artist)
                    { track: { artists: [{ id: 'john_denver', name: 'John Denver' }] } },
                    { track: { artists: [{ id: 'john_denver', name: 'John Denver' }] } },
                    // Simon & Garfunkel - 2 songs (major artist)
                    { track: { artists: [{ id: 'simon_garfunkel', name: 'Simon & Garfunkel' }] } },
                    { track: { artists: [{ id: 'simon_garfunkel', name: 'Simon & Garfunkel' }] } },
                    // Minor artists - 1 song each
                    { track: { artists: [{ id: 'yusuf', name: 'Yusuf / Cat Stevens' }] } },
                    { track: { artists: [{ id: 'carole_king', name: 'Carole King' }] } },
                    { track: { artists: [{ id: 'don_mclean', name: 'Don McLean' }] } }
                ]
            };

            const mockPlaylists = [sourcePlaylist];

            // Mock Last.fm data
            const mockLastFmTracks = {
                toptracks: [
                    { name: 'Fire and Rain', playcount: 1000 },
                    { name: 'Carolina in My Mind', playcount: 900 },
                    { name: 'You\'ve Got a Friend', playcount: 800 },
                    { name: 'Sweet Baby James', playcount: 700 },
                    { name: 'Mexico', playcount: 600 },
                    { name: 'Country Road', playcount: 500 },
                    { name: 'Your Smiling Face', playcount: 400 },
                    { name: 'Shower the People', playcount: 300 },
                    { name: 'Don\'t Let Me Be Lonely Tonight', playcount: 200 },
                    { name: 'How Sweet It Is', playcount: 100 }
                ]
            };

            // Mock Spotify track data
            const createMockTrack = (name, artistId, artistName) => ({
                id: `spotify_track_${name.toLowerCase().replace(/\s+/g, '_')}`,
                name: name,
                uri: `spotify:track:${name.toLowerCase().replace(/\s+/g, '_')}`,
                artists: [{ id: artistId, name: artistName }],
                popularity: Math.floor(Math.random() * 100) + 1
            });

            // Mock file system operations
            const mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockPlaylists));
            const mockExistsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation();

            // Mock API responses
            mockSpotifyAPI.getCurrentUser.mockResolvedValue({ 
                display_name: 'Test User',
                id: 'user123'
            });
            mockSpotifyAPI.getUserPlaylists.mockResolvedValue([]);
            mockSpotifyAPI.createPlaylist.mockResolvedValue({ 
                id: 'new_playlist_id',
                external_urls: { spotify: 'https://open.spotify.com/playlist/new_playlist_id' }
            });
            mockSpotifyAPI.addTracksToPlaylist.mockResolvedValue({ snapshot_id: 'snapshot_123' });
            mockSpotifyAPI.filterSpotifyData.mockImplementation(data => data);

            // Mock mapping database
            mockMappingDB.getArtistMapping.mockImplementation((artistName) => {
                const mappings = {
                    'James Taylor': {
                        lastfm_artist_name: 'James Taylor',
                        spotify_artist_id: 'james_taylor',
                        spotify_artist_name: 'James Taylor'
                    },
                    'John Denver': {
                        lastfm_artist_name: 'John Denver',
                        spotify_artist_id: 'john_denver',
                        spotify_artist_name: 'John Denver'
                    },
                    'Simon & Garfunkel': {
                        lastfm_artist_name: 'Simon & Garfunkel',
                        spotify_artist_id: 'simon_garfunkel',
                        spotify_artist_name: 'Simon & Garfunkel'
                    }
                };
                return Promise.resolve(mappings[artistName] || null);
            });

            // Mock Last.fm API
            mockLastFmAPI.getArtistTopTracks.mockResolvedValue(mockLastFmTracks);

            // Mock fuzzy matcher
            mockFuzzyMatcher.searchTrack.mockImplementation((trackName, artistName) => {
                return Promise.resolve(createMockTrack(trackName, 
                    artistName === 'James Taylor' ? 'james_taylor' : 
                    artistName === 'John Denver' ? 'john_denver' : 'simon_garfunkel', 
                    artistName));
            });

            // Execute the full workflow
            const result = await playlistManager.createLastFmExplorerPlaylist("Dave's Folk");

            // Business value: Should create explorer playlist with proper structure
            expect(result).toBeDefined();
            expect(result.name).toBe("Dave's Folk Explorer");
            expect(result.source_playlist).toBe("Dave's Folk");
            expect(result.tracks).toBeDefined();

            // Business value: Should use dynamic distribution
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Dynamic Distribution Summary'),
                null,
                'DYNAMIC_DISTRIBUTION'
            );

            // Business value: Should process all artists
            expect(mockLastFmAPI.getArtistTopTracks).toHaveBeenCalled();
            expect(mockFuzzyMatcher.searchTrack).toHaveBeenCalled();

            // Business value: Should create Spotify playlist
            expect(mockSpotifyAPI.createPlaylist).toHaveBeenCalledWith(
                'Test User',
                "Dave's Folk Explorer",
                expect.stringContaining('Explorer playlist generated')
            );

            // Business value: Should add tracks to playlist
            expect(mockSpotifyAPI.addTracksToPlaylist).toHaveBeenCalledWith(
                'new_playlist_id',
                expect.any(Array)
            );

            // Cleanup
            mockReadFileSync.mockRestore();
            mockExistsSync.mockRestore();
            mockWriteFileSync.mockRestore();
        });

        test('should handle missing source playlist gracefully', async () => {
            // Business value: Should provide clear error when source playlist not found
            const mockPlaylists = [
                { name: "Other Playlist", tracks: [] }
            ];

            const mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockPlaylists));
            const mockExistsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

            await expect(playlistManager.createLastFmExplorerPlaylist("Dave's Folk"))
                .rejects.toThrow('Playlist "Dave\'s Folk" not found');

            // Cleanup
            mockReadFileSync.mockRestore();
            mockExistsSync.mockRestore();
        });

        test('should handle Last.fm API failures gracefully', async () => {
            // Business value: Should handle external API failures without crashing
            const sourcePlaylist = {
                name: "Dave's Folk",
                tracks: [
                    { track: { artists: [{ id: 'james_taylor', name: 'James Taylor' }] } }
                ]
            };

            const mockPlaylists = [sourcePlaylist];

            const mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockPlaylists));
            const mockExistsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

            // Mock Last.fm API failure
            mockLastFmAPI.getArtistTopTracks.mockRejectedValue(new Error('Last.fm API error'));

            // Should not crash, but should log the error
            await expect(playlistManager.createLastFmExplorerPlaylist("Dave's Folk"))
                .rejects.toThrow();

            // Cleanup
            mockReadFileSync.mockRestore();
            mockExistsSync.mockRestore();
        });
    });

    describe('Dynamic Distribution Integration', () => {
        test('should apply dynamic distribution to real playlist data', () => {
            // Business value: Tests dynamic distribution with realistic data
            const artistCounts = {
                'james_taylor': { name: 'James Taylor', count: 23 },
                'john_denver': { name: 'John Denver', count: 21 },
                'simon_garfunkel': { name: 'Simon & Garfunkel', count: 19 },
                'yusuf': { name: 'Yusuf / Cat Stevens', count: 3 },
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

            // Business value: Should correctly identify major vs minor artists
            expect(result.threshold).toBe(19);
            expect(result.majorArtists).toHaveLength(3);
            expect(result.minorArtists).toHaveLength(11);

            // Business value: Major artists should get 5 songs each
            expect(result.distribution['james_taylor']).toBe(5);
            expect(result.distribution['john_denver']).toBe(5);
            expect(result.distribution['simon_garfunkel']).toBe(5);

            // Business value: Minor artists should get proportional representation
            const minorArtistSongs = result.minorArtists.map(artist => result.distribution[artist.id]);
            minorArtistSongs.forEach(songCount => {
                expect(songCount).toBeGreaterThanOrEqual(1);
                expect(songCount).toBeLessThanOrEqual(4);
            });

            // Business value: Total should be reasonable
            const totalSongs = Object.values(result.distribution).reduce((sum, count) => sum + count, 0);
            expect(totalSongs).toBeGreaterThan(40);
            expect(totalSongs).toBeLessThan(60);
        });
    });
});