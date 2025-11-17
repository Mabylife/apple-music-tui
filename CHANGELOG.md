# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-17

### 🎉 Initial Release

#### Added
- **Core Playback Features**
  - Full playback control (play, pause, next, previous)
  - Virtual queue management system
  - Shuffle mode with smart randomization
  - Repeat modes (off, one track, all tracks)
  - Auto-play functionality with station creation
  - Volume control and seeking
  
- **Navigation & UI**
  - Vim-inspired keyboard navigation
  - Multi-layer list navigation (up to 4 layers)
  - Search functionality (Tab to search)
  - Command mode (`:` prefix for commands)
  - Responsive layout (wide/column modes)
  - Album art display with half-block rendering
  
- **Content Browsing**
  - Browse recommendations (smart-sorted)
  - Browse playlists
  - Browse recently played
  - Search songs, albums, artists, playlists
  - Artist deep-dive (Top Tracks / Albums)
  
- **Station Support**
  - Play Apple Music radio stations
  - Dynamic track polling for station mode
  - Separate queue management for stations
  - Smart station transition detection
  
- **Customization**
  - Hot-reload style configuration
  - Custom color schemes (foreground, highlight, error colors)
  - Border style options (8 different styles)
  - Persistent playback state
  
- **Smart Features**
  - Auto-play with station creation from recent tracks
  - Smart content sorting (balanced type distribution)
  - Debounced track switching
  - Intelligent error handling
  - Loading states and user feedback

#### Technical Details
- Built with Ink (React for CLIs)
- TypeScript for type safety
- Socket.io for real-time playback updates
- Cider RPC integration for Apple Music API access
- Virtual queue system for complete playback control
- Ref-based state management for race condition prevention

### Known Limitations
- Requires Cider 2 running on localhost:10767
- Requires Nerd Fonts for proper icon display
- Station mode disables manual shuffle/repeat controls (managed by Apple Music)

---

## Release Notes

This is the first stable release of Apple Music TUI. The application has been thoroughly tested and documented, with comprehensive markdown documentation covering all features and implementation details.

For detailed documentation, see the `/markdowns` directory:
- [USAGE.md](./markdowns/USAGE.md) - User guide
- [QUEUE.md](./markdowns/QUEUE.md) - Queue implementation
- [STATION.md](./markdowns/STATION.md) - Station mode details
- [AUTOPLAY.md](./markdowns/AUTOPLAY.md) - Auto-play feature
- [STYLE.md](./markdowns/STYLE.md) - Customization guide
- [STRUCTURE.md](./markdowns/STRUCTURE.md) - Architecture overview

### Future Considerations
- Additional home page modes (explore mode)
- Extended playlist management features
- Enhanced error recovery mechanisms
- Performance optimizations for large libraries
