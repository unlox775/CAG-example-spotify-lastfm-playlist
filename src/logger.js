const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logsDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }

        this.logGroup = process.env.REQUEST_LOG_GROUP || this.generateLogGroup();
        this.logFile = path.join(this.logsDir, `${this.logGroup}.log`);

        if (!process.env.REQUEST_LOG_GROUP && process.env.NODE_ENV !== 'test') {
            console.warn(`REQUEST_LOG_GROUP not set; using generated value: ${this.logGroup}`);
        }
    }

    generateLogGroup() {
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '_');
        return `${timestamp}_spotify_library`;
    }

    formatLogLine(level, message, data = null, toolName = null) {
        const timestamp = new Date().toISOString();
        const parts = [`[${timestamp}]`, `[${level.toUpperCase()}]`];

        if (toolName) {
            parts.push(`[${toolName}]`);
        }

        parts.push(String(message));

        if (data !== null && data !== undefined) {
            if (typeof data === 'string') {
                parts.push(data);
            } else {
                try {
                    parts.push(JSON.stringify(data));
                } catch (error) {
                    parts.push(String(data));
                }
            }
        }

        return parts.join(' ');
    }

    writeLine(level, line) {
        if (level === 'error') {
            console.error(line);
        } else if (level === 'warn') {
            console.warn(line);
        } else {
            console.log(line);
        }

        fs.appendFileSync(this.logFile, `${line}\n`);
    }

    log(level, message, data = null, toolName = null) {
        const line = this.formatLogLine(level, message, data, toolName);
        this.writeLine(level, line);
    }

    info(message, data = null, toolName = null) {
        this.log('info', message, data, toolName);
    }

    warn(message, data = null, toolName = null) {
        this.log('warn', message, data, toolName);
    }

    error(message, data = null, toolName = null) {
        this.log('error', message, data, toolName);
    }

    debug(message, data = null, toolName = null) {
        this.log('debug', message, data, toolName);
    }

    logMappingAttempt(lastfmArtist, lastfmTrack, spotifyMatches) {
        this.info(`Mapping attempt: ${lastfmTrack} by ${lastfmArtist} (${spotifyMatches.length} matches)`, null, 'FUZZY_MATCH');
    }

    logMappingFailure(lastfmArtist, lastfmTrack, spotifyMatches, reason) {
        this.warn(`Mapping failed: ${lastfmTrack} by ${lastfmArtist} - ${reason}`, {
            available_matches: spotifyMatches.length
        }, 'FUZZY_MATCH');
    }

    logMappingSuccess(lastfmArtist, lastfmTrack) {
        this.info(`Mapping successful: ${lastfmTrack} by ${lastfmArtist}`, null, 'FUZZY_MATCH');
    }

    logArtistMappingAttempt(lastfmArtist, spotifyMatches, selectedMatch = null) {
        this.info(`Artist mapping attempt: ${lastfmArtist}`, {
            lastfm_artist: lastfmArtist,
            match_count: spotifyMatches.length,
            selected_match: selectedMatch ? {
                id: selectedMatch.id,
                name: selectedMatch.name
            } : null
        }, 'FUZZY_MATCH');
    }

    logArtistMappingFailure(lastfmArtist, spotifyMatches, reason) {
        this.warn(`Artist mapping failed: ${lastfmArtist} - ${reason}`, {
            lastfm_artist: lastfmArtist,
            reason,
            available_matches: spotifyMatches.length,
            top_matches: spotifyMatches.slice(0, 3).map(match => ({
                id: match.id,
                name: match.name
            }))
        }, 'FUZZY_MATCH');
    }

    logArtistMappingSuccess(lastfmArtist, spotifyMatch) {
        this.info(`Artist mapping successful: ${lastfmArtist}`, {
            lastfm_artist: lastfmArtist,
            spotify_match: {
                id: spotifyMatch.id,
                name: spotifyMatch.name,
                similarity_score: spotifyMatch.similarity_score
            }
        }, 'FUZZY_MATCH');
    }

    logManualMapping(artistName, mappings) {
        this.info(`Recording manual mappings for artist: ${artistName}`, {
            artist: artistName,
            mappings: mappings.map(mapping => ({
                lastfm_track: mapping.lastfmTrack,
                spotify_track_id: mapping.spotifyTrackId,
                spotify_track_name: mapping.spotifyTrackName
            }))
        }, 'MAP_TRACKS');
    }

    logExplorerProgress(step, details) {
        this.info(`Explorer creation: ${step}`, details, 'CREATE_EXPLORER');
    }

    getLogGroup() {
        return this.logGroup;
    }

    setLogGroup(newLogGroup) {
        this.logGroup = newLogGroup;
        this.logFile = path.join(this.logsDir, `${this.logGroup}.log`);
    }
}

module.exports = Logger;
