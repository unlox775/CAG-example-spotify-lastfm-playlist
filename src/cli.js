#!/usr/bin/env node

const SpotifyAuth = require('./auth');
const PlaylistManager = require('./playlist-manager');
const LastFmAuth = require('./lastfm-auth');
const MappingTools = require('./mapping-tools');

async function main() {
    const command = process.argv[2];
    const args = process.argv.slice(3);
    

    try {
        switch (command) {
            case 'auth':
                if (args.length === 0) {
                    console.error('Usage: node cli.js auth <authorization_code>');
                    process.exit(1);
                }
                const auth = new SpotifyAuth();
                const tokenData = await auth.exchangeCodeForToken(args[0]);
                console.log('Authentication successful!');
                console.log('Access token:', tokenData.access_token);
                break;

            case 'refresh-token':
                const auth2 = new SpotifyAuth();
                const refreshedToken = await auth2.refreshToken();
                console.log('Token refreshed successfully!');
                console.log('New access token:', refreshedToken.access_token);
                break;

            case 'sync-playlists':
                const manager = new PlaylistManager();
                await manager.syncPlaylists();
                break;

            case 'create-explorer':
                if (args.length === 0) {
                    console.error('Usage: node cli.js create-explorer <playlist-name>');
                    process.exit(1);
                }
                const manager2 = new PlaylistManager();
                await manager2.createExplorerPlaylist(args[0]);
                break;

            case 'create-lastfm-explorer':
                if (args.length === 0) {
                    console.error('Usage: node cli.js create-lastfm-explorer <playlist-name>');
                    process.exit(1);
                }
                const manager5 = new PlaylistManager();
                await manager5.createLastFmExplorerPlaylist(args[0]);
                break;

            case 'record-mapping':
                if (args.length < 3) {
                    console.error('Usage: node cli.js record-mapping <artist-name> <lastfm-track> <spotify-track-id> [spotify-track-name] [spotify-artist-name]');
                    process.exit(1);
                }
                const mappingTools4 = new MappingTools();
                await mappingTools4.init();
                
                const mapping = {
                    lastfmTrack: args[1],
                    spotifyTrackId: args[2],
                    spotifyTrackName: args[3] || args[1], // Use Last.fm name if not provided
                    spotifyArtistName: args[4] || args[0] // Use artist name if not provided
                };
                
                await mappingTools4.recordManualMappings(args[0], [mapping]);
                await mappingTools4.close();
                break;

            case 'add-artist':
                if (args.length === 0) {
                    console.error('Usage: node cli.js add-artist <artist-name>');
                    process.exit(1);
                }
                const manager3 = new PlaylistManager();
                await manager3.addArtistToDillNDoo(args[0]);
                break;

            case 'remove-artist':
                if (args.length === 0) {
                    console.error('Usage: node cli.js remove-artist <artist-name>');
                    process.exit(1);
                }
                const manager4 = new PlaylistManager();
                await manager4.removeArtistFromDillNDoo(args[0]);
                break;

            case 'auth-lastfm':
                const lastfmAuth = new LastFmAuth();
                const lastfmAuthUrl = lastfmAuth.generateAuthUrl();
                console.log('Last.fm Authentication URL:');
                console.log(lastfmAuthUrl);
                break;

            case 'auth-lastfm-token':
                if (args.length === 0) {
                    console.error('Usage: node cli.js auth-lastfm-token <token>');
                    process.exit(1);
                }
                const lastfmAuth2 = new LastFmAuth();
                const session = await lastfmAuth2.getSession(args[0]);
                console.log('Last.fm authentication successful!');
                console.log('Session key:', session.key);
                console.log('Username:', session.name);
                break;

            case 'map-artist':
                if (args.length === 0) {
                    console.error('Usage: node cli.js map-artist <artist-name>');
                    process.exit(1);
                }
                const mappingTools = new MappingTools();
                await mappingTools.init();
                
                await mappingTools.mapArtist(args[0]);
                
                await mappingTools.close();
                break;

            case 'map-tracks':
                if (args.length === 0) {
                    console.error('Usage: node cli.js map-tracks <artist-name>');
                    process.exit(1);
                }
                const mappingTools2 = new MappingTools();
                await mappingTools2.init();
                
                await mappingTools2.mapArtistTracks(args[0]);
                
                await mappingTools2.close();
                break;

            case 'mapping-status':
                const mappingTools3 = new MappingTools();
                await mappingTools3.init();
                await mappingTools3.showMappingStatus();
                await mappingTools3.close();
                break;

            case 'delete-playlist':
                if (args.length === 0) {
                    console.error('Usage: node cli.js delete-playlist <playlist-id>');
                    process.exit(1);
                }
                const api = new (require('./spotify-api'))();
                await api.deletePlaylist(args[0]);
                console.log(`Successfully deleted playlist: ${args[0]}`);
                break;

            default:
                console.log('Spotify Library Management CLI');
                console.log('');
                console.log('Commands:');
                console.log('  auth <code>              - Exchange authorization code for token');
                console.log('  refresh-token           - Refresh expired token');
                console.log('  sync-playlists          - Sync all playlists from Spotify');
                console.log('  create-explorer <name>  - Create explorer playlist from source playlist');
                console.log('  create-lastfm-explorer <name> - Create Last.fm explorer playlist with mapping gate');
                console.log('  record-mapping <artist> <lastfm-track> <spotify-track-id> [spotify-track-name] [spotify-artist-name] - Record manual mapping');
                console.log('  add-artist <name>       - Add artist to Dill \'n\' Doo playlist');
                console.log('  remove-artist <name>    - Remove artist from Dill \'n\' Doo playlist');
                console.log('  auth-lastfm             - Get Last.fm authentication URL');
                console.log('  map-artist <name>       - Map Last.fm artist to Spotify');
                console.log('  map-tracks <name>       - Map Last.fm tracks for artist to Spotify');
                console.log('  mapping-status          - Show current mapping status');
                console.log('  delete-playlist <id>    - Delete/unfollow a playlist');
                break;
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
