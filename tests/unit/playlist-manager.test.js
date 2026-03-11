const PlaylistManager = require('../../src/playlist-manager');
const fs = require('fs');
const path = require('path');

// Mock the dependencies
jest.mock('../../src/spotify-api');
jest.mock('../../src/lastfm-api');
jest.mock('../../src/mapping-db');
jest.mock('../../src/fuzzy-matcher');
jest.mock('../../src/logger');

describe('PlaylistManager', () => {
    let playlistManager;
    let mockSpotifyAPI;
    let mockLastFmAPI;
    let mockMappingDB;
    let mockFuzzyMatcher;
    let mockLogger;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Create mock instances
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

        // Mock the constructors
        require('../../src/spotify-api').mockImplementation(() => mockSpotifyAPI);
        require('../../src/lastfm-api').mockImplementation(() => mockLastFmAPI);
        require('../../src/mapping-db').mockImplementation(() => mockMappingDB);
        require('../../src/fuzzy-matcher').mockImplementation(() => mockFuzzyMatcher);
        require('../../src/logger').mockImplementation(() => mockLogger);

        playlistManager = new PlaylistManager();
    });

    describe('toSnakeCase', () => {
        test('should convert playlist names to valid filenames', () => {
            // Business value: Ensures playlist names can be safely used as filenames
            expect(playlistManager.toSnakeCase("Dave's Folk")).toBe('daves_folk');
            expect(playlistManager.toSnakeCase("All Out 80s")).toBe('all_out_80s');
            expect(playlistManager.toSnakeCase("Alternative Rock!")).toBe('alternative_rock');
            expect(playlistManager.toSnakeCase("Dill & Doo")).toBe('dill_doo');
            expect(playlistManager.toSnakeCase("90s Rock Music Hits Playlist - Greatest 1990's Rock Songs (2)"))
                .toBe('90s_rock_music_hits_playlist_greatest_1990s_rock_songs_2');
        });
    });

    describe('getPlaylistFilename', () => {
        test('should generate consistent filenames for playlists', () => {
            // Business value: Consistent naming ensures reliable file management
            const playlist = { name: "Dave's Folk", id: "abc123" };
            const filename = playlistManager.getPlaylistFilename(playlist);
            expect(filename).toBe('playlist_daves_folk_abc123.json');
        });
    });

    describe('syncPlaylists', () => {
        test('should sync playlists and create proper file structure', async () => {
            // Business value: Ensures playlists are properly synced and stored
            const mockUser = { display_name: 'Test User' };
            const mockPlaylists = [
                { id: '1', name: 'Playlist 1' },
                { id: '2', name: 'Playlist 2' }
            ];
            const mockPlaylistDetails = { id: '1', name: 'Playlist 1' };
            const mockTracks = [
                { track: { id: 'track1', name: 'Song 1', artists: [{ id: 'artist1', name: 'Artist 1' }] } }
            ];

            mockSpotifyAPI.getCurrentUser.mockResolvedValue({ ...mockUser, id: 'user123' });
            mockSpotifyAPI.getUserPlaylists.mockResolvedValue(mockPlaylists);
            mockSpotifyAPI.getPlaylistDetails.mockResolvedValue(mockPlaylistDetails);
            mockSpotifyAPI.getPlaylistTracks.mockResolvedValue(mockTracks);
            mockSpotifyAPI.filterSpotifyData.mockImplementation(data => data);

            // Mock file system operations
            const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation();
            const mockReadDirSync = jest.spyOn(fs, 'readdirSync').mockReturnValue([]);
            const mockExistsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            const mockMkdirSync = jest.spyOn(fs, 'mkdirSync').mockImplementation();
            
            // Mock the directory check to return false so mkdirSync gets called
            mockExistsSync.mockImplementation((path) => {
                if (path.includes('spotify_playlists') || path.includes('mappings')) {
                    return false;
                }
                return true;
            });

            await playlistManager.syncPlaylists();

            // Business value: Should create proper directory structure
            expect(mockMkdirSync).toHaveBeenCalled();
            
            // Business value: Should save playlists metadata
            expect(mockWriteFileSync).toHaveBeenCalledWith(
                expect.stringContaining('playlists.json'),
                expect.stringContaining('Playlist 1')
            );

            // Business value: Should save individual playlist files
            expect(mockWriteFileSync).toHaveBeenCalledWith(
                expect.stringContaining('playlist_playlist_1_1.json'),
                expect.any(String)
            );

            // Cleanup
            mockWriteFileSync.mockRestore();
            mockReadDirSync.mockRestore();
            mockExistsSync.mockRestore();
            mockMkdirSync.mockRestore();
        });
    });

    describe('createLastFmExplorerPlaylist', () => {
        test('should create explorer playlist with dynamic distribution', async () => {
            // Business value: Ensures the core playlist creation logic works with dynamic distribution
            const mockPlaylists = [
                {
                    name: "Dave's Folk",
                    tracks: [
                        { track: { artists: [{ id: 'james_taylor', name: 'James Taylor' }] } },
                        { track: { artists: [{ id: 'james_taylor', name: 'James Taylor' }] } },
                        { track: { artists: [{ id: 'james_taylor', name: 'James Taylor' }] } },
                        { track: { artists: [{ id: 'john_denver', name: 'John Denver' }] } },
                        { track: { artists: [{ id: 'john_denver', name: 'John Denver' }] } },
                        { track: { artists: [{ id: 'single_artist', name: 'Single Artist' }] } }
                    ]
                }
            ];

            const mockLastFmTracks = {
                toptracks: [
                    { name: 'Song 1', playcount: 1000 },
                    { name: 'Song 2', playcount: 900 },
                    { name: 'Song 3', playcount: 800 },
                    { name: 'Song 4', playcount: 700 },
                    { name: 'Song 5', playcount: 600 }
                ]
            };

            const mockSpotifyTrack = {
                id: 'spotify_track_1',
                name: 'Song 1',
                uri: 'spotify:track:1',
                artists: [{ id: 'james_taylor', name: 'James Taylor' }],
                popularity: 80
            };

            // Mock file system
            const mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockPlaylists));
            const mockExistsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

            // Mock API responses
            mockMappingDB.getArtistMapping.mockResolvedValue({
                lastfm_artist_name: 'James Taylor',
                spotify_artist_id: 'james_taylor',
                spotify_artist_name: 'James Taylor'
            });

            mockLastFmAPI.getArtistTopTracks.mockResolvedValue(mockLastFmTracks);
            mockFuzzyMatcher.searchTrack.mockResolvedValue(mockSpotifyTrack);
            mockSpotifyAPI.getUserPlaylists.mockResolvedValue([]);
            mockSpotifyAPI.createPlaylist.mockResolvedValue({ id: 'new_playlist_id' });
            mockSpotifyAPI.addTracksToPlaylist.mockResolvedValue({ snapshot_id: 'snapshot_123' });

            const result = await playlistManager.createLastFmExplorerPlaylist("Dave's Folk");

            // Business value: Should create explorer playlist with proper structure
            expect(result).toBeDefined();
            expect(result.name).toBe("Dave's Folk Explorer");
            expect(result.source_playlist).toBe("Dave's Folk");

            // Business value: Should use dynamic distribution
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Dynamic Distribution Summary'),
                null,
                'DYNAMIC_DISTRIBUTION'
            );

            // Business value: Should process artists and map tracks
            expect(mockLastFmAPI.getArtistTopTracks).toHaveBeenCalled();
            expect(mockFuzzyMatcher.searchTrack).toHaveBeenCalled();

            // Cleanup
            mockReadFileSync.mockRestore();
            mockExistsSync.mockRestore();
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
    });

    describe('addArtistToDillNDoo', () => {
        test('should add artist to Dill n Doo playlist', async () => {
            // Business value: Ensures artist addition works correctly
            const mockArtist = { id: 'artist1', name: 'Test Artist' };
            const mockPlaylists = [
                { id: 'dill_ndoo_id', name: 'Dill & Doo' }
            ];
            const mockTracks = {
                tracks: [
                    { uri: 'spotify:track:1' },
                    { uri: 'spotify:track:2' }
                ]
            };

            mockSpotifyAPI.searchArtists.mockResolvedValue([mockArtist]);
            mockSpotifyAPI.getUserPlaylists.mockResolvedValue(mockPlaylists);
            mockSpotifyAPI.getPlaylistTracks.mockResolvedValue([]);
            mockSpotifyAPI.getArtistTopTracks.mockResolvedValue(mockTracks);
            mockSpotifyAPI.addTracksToPlaylist.mockResolvedValue({});

            const result = await playlistManager.addArtistToDillNDoo('Test Artist');

            // Business value: Should find artist and add to playlist
            expect(mockSpotifyAPI.searchArtists).toHaveBeenCalledWith('Test Artist');
            expect(mockSpotifyAPI.getArtistTopTracks).toHaveBeenCalledWith('artist1');
            expect(mockSpotifyAPI.addTracksToPlaylist).toHaveBeenCalledWith(
                'dill_ndoo_id',
                ['spotify:track:1', 'spotify:track:2']
            );

            expect(result.playlist).toEqual(mockPlaylists[0]);
            expect(result.artist).toEqual(mockArtist);
            expect(result.addedTracks).toBe(2);
        });

        test('should prevent adding duplicate artists', async () => {
            // Business value: Prevents overwriting user's manual curation
            const mockArtist = { id: 'artist1', name: 'Test Artist' };
            const mockPlaylists = [
                { id: 'dill_ndoo_id', name: 'Dill & Doo' }
            ];
            const mockExistingTracks = [
                { track: { artists: [{ id: 'artist1', name: 'Test Artist' }] } }
            ];

            mockSpotifyAPI.searchArtists.mockResolvedValue([mockArtist]);
            mockSpotifyAPI.getUserPlaylists.mockResolvedValue(mockPlaylists);
            mockSpotifyAPI.getPlaylistTracks.mockResolvedValue(mockExistingTracks);

            await expect(playlistManager.addArtistToDillNDoo('Test Artist'))
                .rejects.toThrow('Artist "Test Artist" is already in Dill \'n\' Doo playlist');

            // Business value: Should not add tracks if artist already exists
            expect(mockSpotifyAPI.addTracksToPlaylist).not.toHaveBeenCalled();
        });
    });
});