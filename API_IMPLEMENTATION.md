# API Implementation Summary

This document summarizes the API fetching implementation for Lists and SearchBar.

## Implemented Features

### 1. **Recommendations on Startup**
- Shows "Loading.." placeholder immediately on app start
- Automatically loads user recommendations in background
- Displays the first 10 items from Apple Music recommendations
- Supports playlists, albums, stations, and more
- Uses endpoint: `/v1/me/recommendations?limit=10`

### 2. **Search Functionality**
- Press `Tab` to enter search mode
- Type query and press `Enter` to search
- Shows "Loading.." in first layer while searching
- Searches across songs, albums, and artists
- Returns results prioritized as: Artists → Albums → Songs
- Uses endpoint: `/v1/catalog/{storefront}/search?term={query}&types=songs,albums,artists&limit=10`

### 3. **Layer Navigation**

#### Track (Songs) - 󰝚
- Pressing `Right Arrow` on a track **plays it immediately**
- Uses endpoint: `/api/v1/playback/play-item` with `type: "song"`

#### Album - 󰀥
- Pressing `Right Arrow` on an album loads all tracks
- Creates a new layer with the album's tracks
- Uses endpoint: `/v1/catalog/{storefront}/albums/{albumId}`

#### Playlist - 󰲸
- Pressing `Right Arrow` on a playlist loads all tracks
- Creates a new layer with the playlist's tracks
- Uses endpoint: `/v1/catalog/{storefront}/playlists/{playlistId}`

#### Station - 󰐹
- Pressing `Right Arrow` on a station **plays it immediately**
- Stations don't have track lists, they are streamed dynamically
- Uses endpoint: `/api/v1/playback/play-item` with `type: "station"`

#### Artist - 󱍞
- Pressing `Right Arrow` on an artist creates a submenu with:
  - **Top Tracks** (if available) - 󰝚
  - **Albums** - 󰀥
  - **Tracks** - 󰝚 (all songs by artist)
- Uses endpoint: `/v1/catalog/{storefront}/artists/{artistId}`

#### Artist Submenu Items
- **Top Tracks**: Loads up to 20 top songs by the artist
  - Uses endpoint: `/v1/catalog/{storefront}/artists/{artistId}/songs?limit=20`
- **Albums**: Loads up to 20 albums by the artist (sorted by newest)
  - Uses endpoint: `/v1/catalog/{storefront}/artists/{artistId}/albums?limit=20`
- **Tracks**: Loads up to 20 songs by the artist (sorted by newest)
  - Uses endpoint: `/v1/catalog/{storefront}/artists/{artistId}/songs?limit=20`

### 4. **Loading State (UX Enhancement)**
- **First layer loading**: Shows "Loading.." immediately on app start
- **Navigation loading**: When pressing right arrow, immediately shows "Loading.." placeholder
- User moves to the next layer instantly
- Data is fetched in the background
- Once loaded, the placeholder is replaced with actual content
- Provides responsive feedback and smooth navigation experience

### 5. **Text Display Fix**
- Added trailing space to all labels to prevent Ink from truncating the last character
- Ensures complete text display for all item types
- Particularly important for English text and symbols

## API Service Structure

### File: `src/services/api.ts`

Main class: `CiderAPI`

#### Methods:
- `getRecommendations(limit)` - Fetch user recommendations
- `search(query, limit)` - Search for songs, albums, and artists
- `getAlbumTracks(albumId)` - Get tracks from an album
- `getPlaylistTracks(playlistId)` - Get tracks from a playlist
- `getArtistContent(artistId)` - Get artist content categories (Top Tracks, Albums, Tracks)
- `getArtistTopTracks(artistId)` - Get artist's top songs
- `getArtistAlbums(artistId)` - Get artist's albums
- `playItem(id, type)` - Play a track or station immediately

## Usage in App

The `App.tsx` file integrates the API:
1. Shows loading state immediately on mount
2. Loads recommendations in background
3. Handles search on `Enter` key with loading state
4. Immediately creates loading layer on `Right Arrow`
5. Fetches content in background
6. Replaces loading state with actual data
7. Plays tracks/stations immediately when selected

## Icons Used
- 󰝚 (U+F075A) - Track/Song
- 󰀥 (U+F0025) - Album
- 󱍞 (U+F135E) - Artist
- 󰲸 (U+F0CB8) - Playlist
- 󰐹 (U+F0439) - Station

## API Limitations
- Maximum limit for artist songs/albums: 20 items
- Storefront is currently hardcoded to "tw" (Taiwan)

## Bug Fixes (Latest Update)
1. ✅ Loading state now shows on first layer (app start)
2. ✅ Stations play directly (they are dynamic streams, not playlists)
3. ✅ Text truncation fixed by adding trailing space to all labels
4. ✅ Artist page now shows: Top Tracks, Albums, and Tracks
5. ✅ Artist categories (Top Tracks, Albums, Tracks) now navigate correctly

## Testing
All API endpoints and features have been tested and verified with Cider running on `localhost:10767`.
