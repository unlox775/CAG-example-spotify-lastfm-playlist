const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class MappingDB {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'data', 'mappings', 'mapping.db');
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const createTables = `
                CREATE TABLE IF NOT EXISTS artist_mappings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lastfm_artist_name TEXT UNIQUE NOT NULL,
                    lastfm_artist_mbid TEXT,
                    spotify_artist_id TEXT UNIQUE NOT NULL,
                    spotify_artist_name TEXT NOT NULL,
                    confidence REAL DEFAULT 0.0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS track_mappings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lastfm_artist_name TEXT NOT NULL,
                    lastfm_track_name TEXT NOT NULL,
                    spotify_track_id TEXT UNIQUE NOT NULL,
                    spotify_track_name TEXT NOT NULL,
                    spotify_artist_name TEXT NOT NULL,
                    confidence REAL DEFAULT 0.0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(lastfm_artist_name, lastfm_track_name)
                );

                CREATE INDEX IF NOT EXISTS idx_artist_lastfm_name ON artist_mappings(lastfm_artist_name);
                CREATE INDEX IF NOT EXISTS idx_artist_spotify_id ON artist_mappings(spotify_artist_id);
                CREATE INDEX IF NOT EXISTS idx_track_lastfm ON track_mappings(lastfm_artist_name, lastfm_track_name);
                CREATE INDEX IF NOT EXISTS idx_track_spotify_id ON track_mappings(spotify_track_id);
            `;

            this.db.exec(createTables, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async saveArtistMapping(lastfmArtist, spotifyArtistId, spotifyArtistName, confidence = 1.0) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO artist_mappings 
                (lastfm_artist_name, spotify_artist_id, spotify_artist_name, confidence, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            this.db.run(sql, [lastfmArtist, spotifyArtistId, spotifyArtistName, confidence], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async saveTrackMapping(lastfmArtist, lastfmTrack, spotifyTrackId, spotifyTrackName, spotifyArtistName, confidence = 1.0) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO track_mappings 
                (lastfm_artist_name, lastfm_track_name, spotify_track_id, spotify_track_name, spotify_artist_name, confidence, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            this.db.run(sql, [lastfmArtist, lastfmTrack, spotifyTrackId, spotifyTrackName, spotifyArtistName, confidence], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async getArtistMapping(lastfmArtist) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM artist_mappings WHERE lastfm_artist_name = ?';
            this.db.get(sql, [lastfmArtist], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getTrackMapping(lastfmArtist, lastfmTrack) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM track_mappings WHERE lastfm_artist_name = ? AND lastfm_track_name = ?';
            this.db.get(sql, [lastfmArtist, lastfmTrack], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getAllArtistMappings() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM artist_mappings ORDER BY lastfm_artist_name';
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getAllTrackMappings() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM track_mappings ORDER BY lastfm_artist_name, lastfm_track_name';
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getUnmappedArtists() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT DISTINCT lastfm_artist_name 
                FROM track_mappings 
                WHERE spotify_track_id IS NULL OR spotify_track_id = ''
            `;
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => row.lastfm_artist_name));
                }
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = MappingDB;
