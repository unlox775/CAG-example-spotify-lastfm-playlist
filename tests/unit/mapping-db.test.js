const MappingDB = require('../../src/mapping-db');

// Mock sqlite3 completely
jest.mock('sqlite3', () => {
    const mockDatabase = {
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn(),
        close: jest.fn()
    };

    return {
        verbose: () => ({
            Database: jest.fn().mockImplementation((path, callback) => {
                // Simulate successful database creation
                if (callback) {
                    callback(null);
                }
                return mockDatabase;
            })
        })
    };
});

describe('MappingDB', () => {
    let mappingDB;

    beforeEach(() => {
        jest.clearAllMocks();
        mappingDB = new MappingDB();
    });

    describe('Database Operations', () => {
        test('should handle artist mapping operations', async () => {
            // Business value: Tests core mapping functionality
            const lastfmArtistName = 'James Taylor';
            const spotifyArtistId = 'james_taylor_id';
            const spotifyArtistName = 'James Taylor';
            const similarityScore = 0.95;

            // Mock successful database operations
            const mockDb = mappingDB.db;
            if (mockDb) {
                mockDb.run.mockImplementation((sql, params, callback) => {
                    callback(null);
                });
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, {
                        lastfm_artist_name: lastfmArtistName,
                        spotify_artist_id: spotifyArtistId,
                        spotify_artist_name: spotifyArtistName,
                        similarity_score: similarityScore
                    });
                });
            }

            // Test save operation
            await expect(mappingDB.saveArtistMapping(
                lastfmArtistName,
                spotifyArtistId,
                spotifyArtistName,
                similarityScore
            )).resolves.not.toThrow();

            // Test get operation
            const result = await mappingDB.getArtistMapping(lastfmArtistName);
            expect(result).toBeDefined();
        });

        test('should handle track mapping operations', async () => {
            // Business value: Tests track mapping functionality
            const lastfmTrack = 'Fire and Rain';
            const spotifyTrackId = 'fire_and_rain_id';
            const spotifyTrackName = 'Fire and Rain';
            const artistName = 'James Taylor';

            // Mock successful database operations
            const mockDb = mappingDB.db;
            if (mockDb) {
                mockDb.run.mockImplementation((sql, params, callback) => {
                    callback(null);
                });
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, {
                        lastfm_track: lastfmTrack,
                        spotify_track_id: spotifyTrackId,
                        spotify_track_name: spotifyTrackName,
                        artist_name: artistName
                    });
                });
            }

            // Test save operation
            await expect(mappingDB.saveTrackMapping(
                lastfmTrack,
                spotifyTrackId,
                spotifyTrackName,
                artistName
            )).resolves.not.toThrow();

            // Test get operation
            const result = await mappingDB.getTrackMapping(lastfmTrack, artistName);
            expect(result).toBeDefined();
        });

        test('should handle database errors gracefully', async () => {
            // Business value: Should handle database errors without crashing
            const mockDb = mappingDB.db;
            if (mockDb) {
                mockDb.run.mockImplementation((sql, params, callback) => {
                    callback(new Error('Database error'));
                });
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(new Error('Query error'));
                });
            }

            // Test error handling
            await expect(mappingDB.saveArtistMapping('test', 'test', 'test', 0.5))
                .rejects.toThrow();
            
            await expect(mappingDB.getArtistMapping('test'))
                .rejects.toThrow();
        });

        test('should handle missing data gracefully', async () => {
            // Business value: Should return null for missing data
            const mockDb = mappingDB.db;
            if (mockDb) {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, null);
                });
            }

            // Test null handling
            const result = await mappingDB.getArtistMapping('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('Business Logic Validation', () => {
        test('should maintain data consistency', async () => {
            // Business value: Ensures data integrity across operations
            const testData = {
                lastfmArtist: 'Test Artist',
                spotifyId: 'test_id',
                spotifyName: 'Test Artist',
                score: 0.9
            };

            const mockDb = mappingDB.db;
            if (mockDb) {
                mockDb.run.mockImplementation((sql, params, callback) => {
                    callback(null);
                });
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, {
                        lastfm_artist_name: testData.lastfmArtist,
                        spotify_artist_id: testData.spotifyId,
                        spotify_artist_name: testData.spotifyName,
                        similarity_score: testData.score
                    });
                });
            }

            // Save data
            await mappingDB.saveArtistMapping(
                testData.lastfmArtist,
                testData.spotifyId,
                testData.spotifyName,
                testData.score
            );

            // Retrieve data
            const result = await mappingDB.getArtistMapping(testData.lastfmArtist);

            // Business value: Data should be consistent
            expect(result.lastfm_artist_name).toBe(testData.lastfmArtist);
            expect(result.spotify_artist_id).toBe(testData.spotifyId);
            expect(result.spotify_artist_name).toBe(testData.spotifyName);
            expect(result.similarity_score).toBe(testData.score);
        });

        test('should handle concurrent operations', async () => {
            // Business value: Should handle multiple simultaneous operations
            const operations = [
                { artist: 'Artist 1', id: 'id1', name: 'Artist 1', score: 0.9 },
                { artist: 'Artist 2', id: 'id2', name: 'Artist 2', score: 0.8 },
                { artist: 'Artist 3', id: 'id3', name: 'Artist 3', score: 0.7 }
            ];

            const mockDb = mappingDB.db;
            if (mockDb) {
                mockDb.run.mockImplementation((sql, params, callback) => {
                    callback(null);
                });
            }

            // Business value: Should handle concurrent saves
            const savePromises = operations.map(op =>
                mappingDB.saveArtistMapping(op.artist, op.id, op.name, op.score)
            );

            await expect(Promise.all(savePromises)).resolves.not.toThrow();
        });
    });
});