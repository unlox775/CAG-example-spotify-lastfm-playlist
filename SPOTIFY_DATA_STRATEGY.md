# Spotify Data Strategy

## Problem
The current system caches the **entire Spotify API response** which includes massive amounts of unused metadata, resulting in:
- `all_playlists_detailed.json`: **1.6M lines** (39MB)
- Individual playlist files: **100K+ lines each**
- Unnecessary storage and processing overhead

## Root Cause
The system calls `getPlaylistTracks()` which returns the full Spotify API response with all metadata fields, but only uses a tiny subset.

## Essential Fields Only

### Track Data (Required)
```json
{
  "id": "track_id",
  "name": "track_name", 
  "uri": "spotify:track:track_id",
  "artists": [
    {
      "id": "artist_id",
      "name": "artist_name"
    }
  ]
}
```

### Album Data (Minimal)
```json
{
  "id": "album_id",
  "name": "album_name",
  "album_type": "album|single|compilation"
}
```

### Playlist Data (Minimal)
```json
{
  "id": "playlist_id",
  "name": "playlist_name",
  "description": "playlist_description",
  "tracks": [/* track objects */]
}
```

## Unused Fields (Can Remove)
- `preview_url`
- `available_markets`
- `explicit`
- `episode`
- `track` (boolean)
- `images` (all image data)
- `external_urls`
- `href`
- `release_date`
- `release_date_precision`
- `total_tracks`
- `followers`
- `collaborative`
- `public`
- `snapshot_id`
- `primary_color`
- `added_at`
- `added_by`
- `owner` (full object)

## Implementation Strategy

### 1. Create Data Filter
- Add `filterSpotifyData()` method to `SpotifyAPI` class
- Strip unused fields before caching
- Reduce file sizes by ~90%

### 2. Update Sync Process
- Apply filtering in `syncPlaylists()`
- Update existing cached files
- Maintain backward compatibility

### 3. API Optimization
- Only request essential fields where possible
- Use field parameters in Spotify API calls
- Implement data validation

## Expected Results
- `all_playlists_detailed.json`: ~160K lines (4MB) - **90% reduction**
- Individual playlists: ~10K lines each - **90% reduction**
- Faster processing and smaller git repository