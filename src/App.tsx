import React, { useState, useEffect, useRef } from "react";
import { Box, useInput, useApp, useStdout } from "ink";
import { TerminalInfoProvider } from "ink-picture";
import { Browser } from "./components/Browser.js";
import { Player } from "./components/Player.js";
import { CommandBar } from "./components/CommandBar.js";
import { SearchBar } from "./components/SearchBar.js";
import { CiderAPI, MusicItem } from "./services/api.js";
import { PlayerAPI } from "./services/player.js";
import { QueueService } from "./services/queue.js";
import { SocketService } from "./services/socket.js";
import { styleService } from "./services/style.js";

interface LayerData {
  id: string;
  items: MusicItem[];
  selectedIndex: number;
  loadingMessage?: string;
}

const MAX_LAYERS = 4;

let layerIdCounter = 0;

export const App: React.FC = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [layers, setLayers] = useState<LayerData[]>([
    {
      id: String(layerIdCounter++),
      items: [],
      selectedIndex: 0,
      loadingMessage: "loading...",
    },
  ]);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [terminalSize, setTerminalSize] = useState({
    width: stdout.columns || 100,
    height: stdout.rows || 30,
  });
  const [commandMode, setCommandMode] = useState(false);
  const [command, setCommand] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [playerUpdateTrigger, setPlayerUpdateTrigger] = useState(0);
  const [nowPlayingId, setNowPlayingId] = useState<string | null>(null);

  // Use ref for isChangingTrack to avoid stale closures and ensure consistency
  const isChangingTrackRef = useRef(false);
  const trackChangeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const setIsChangingTrack = (value: boolean) => {
    isChangingTrackRef.current = value;
  };

  // Debounced track change handler - ensures only final change within 500ms is executed
  const requestTrackChange = (trackId: string, trackType: string = "songs") => {
    // Immediately update UI indicator (zero latency) - this is the source of truth
    // This makes the cyan item in Layer update instantly
    setNowPlayingId(trackId);
    
    // Clear any pending track change request
    if (trackChangeDebounceRef.current) {
      clearTimeout(trackChangeDebounceRef.current);
      trackChangeDebounceRef.current = null;
    }
    
    // Mark as changing track
    setIsChangingTrack(true);
    
    // Buffer: Wait 500ms to ensure this is the final change
    // Only the last change within 500ms window will execute play and update Player UI
    trackChangeDebounceRef.current = setTimeout(() => {
      // Execute play request for the final track ID
      CiderAPI.playItem(trackId, trackType).catch(() => {
        setMessage("Cannot play this track");
        setTimeout(() => setMessage(""), 2000);
      });
      
      // Reset changing track flag
      setIsChangingTrack(false);
      // Trigger player info refresh (art, track info, modes)
      setPlayerUpdateTrigger((prev) => prev + 1);
      trackChangeDebounceRef.current = null;
    }, 500);
  };

  // Load recommendations function
  const loadRecommendations = async () => {
    const loadingLayerId = layers[0]?.id || String(layerIdCounter++);

    try {
      const items = await CiderAPI.getRecommendations(10);
      setLayers([
        {
          id: loadingLayerId,
          items: items.map(
            (item): MusicItem => ({
              id: item.id,
              label: `${item.icon}  ${item.label}`,
              type: item.type,
              icon: item.icon,
              rawData: item.rawData,
              isPlayable: item.isPlayable,
            })
          ),
          selectedIndex: 0,
          loadingMessage: undefined,
        },
      ]);
    } catch (error) {
      console.error("Failed to load recommendations:", error);
      setLayers([
        {
          id: loadingLayerId,
          items: [
            {
              id: "error",
              label: "Error loading...",
              type: "songs",
              icon: "󰀨",
              rawData: null,
            },
          ],
          selectedIndex: 0,
          loadingMessage: undefined,
        },
      ]);
    }
  };

  // Load recommendations on mount
  useEffect(() => {
    loadRecommendations();
    SocketService.connect();

    // Listen for style validation errors
    const unsubscribeStyleError = styleService.onError((error) => {
      setMessage(error);
      setTimeout(() => setMessage(""), 3000);
    });

    return () => {
      SocketService.disconnect();
      unsubscribeStyleError();
    };
  }, []);

  // Monitor playback to auto-play next track
  useEffect(() => {
    let lastTrackName: string | null = null;
    let lastPlaybackTime = 0;
    let trackEndTimeout: NodeJS.Timeout | null = null;

    const unsubscribe = SocketService.onPlayback(async (data) => {
      const currentTime = data.currentPlaybackTime || 0;
      const duration = data.durationInMillis || 0;
      const progress = duration > 0 ? currentTime / duration : 0;

      // Detect track ended (progress >= 99% or reached the end)
      if (progress >= 0.99 && duration > 0) {
        // Check if this is a new track end event and not already changing track manually
        if (
          !isChangingTrackRef.current &&
          (lastTrackName !== data.name || currentTime < lastPlaybackTime)
        ) {
          lastTrackName = data.name;
          lastPlaybackTime = currentTime;

          // Clear any pending timeout
          if (trackEndTimeout) {
            clearTimeout(trackEndTimeout);
          }

          // Small delay to ensure track fully ended
          trackEndTimeout = setTimeout(async () => {
            // Don't auto-play if user is manually changing tracks
            if (trackChangeDebounceRef.current) {
              trackEndTimeout = null;
              return;
            }

            try {
              const [shuffle, repeat] = await Promise.all([
                PlayerAPI.getShuffleMode(),
                PlayerAPI.getRepeatMode(),
              ]);

              const nextIndex = QueueService.getNextIndex(shuffle, repeat);

              if (nextIndex !== null) {
                QueueService.updateCurrentIndex(nextIndex);
                const nextTrack = QueueService.getCurrentTrack();
                if (nextTrack) {
                  requestTrackChange(nextTrack.id, "songs");
                }
              } else {
                // Queue ended
                await PlayerAPI.stop();
                setNowPlayingId(null);
                QueueService.clearQueue();
              }
            } catch (error) {
              console.error("Failed to handle track end:", error);
            } finally {
              trackEndTimeout = null;
            }
          }, 500);
        }
      } else {
        lastPlaybackTime = currentTime;
      }
    });

    return () => {
      // Clean up timeout on unmount
      if (trackEndTimeout) {
        clearTimeout(trackEndTimeout);
      }
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const updateSize = () => {
      setTerminalSize({
        width: stdout.columns || 100,
        height: stdout.rows || 30,
      });
    };

    updateSize();
    stdout.on("resize", updateSize);

    return () => {
      stdout.off("resize", updateSize);
    };
  }, [stdout]);

  const isWide = terminalSize.width > 120;

  useInput((input: string, key: any) => {
    // Always handle command mode and search mode first
    if (commandMode) {
      if (key.return) {
        // Execute command
        if (command === "q" || command === "quit" || command === "qa") {
          exit();
        } else if (command === "home") {
          // Reload recommendations
          setActiveLayerIndex(0);
          setLayers([
            {
              id: String(layerIdCounter++),
              items: [],
              selectedIndex: 0,
              loadingMessage: "loading...",
            },
          ]);
          loadRecommendations();
        } else if (command === "stop") {
          PlayerAPI.stop()
            .then(() => {
              setPlayerUpdateTrigger((prev) => prev + 1);
            })
            .catch((error) => {
              console.error("Failed to stop:", error);
            });
        } else if (command.startsWith("vol ")) {
          const vol = parseInt(command.substring(4));
          if (!isNaN(vol) && vol >= 0 && vol <= 100) {
            PlayerAPI.setVolume(vol / 100)
              .then(() => {
                setMessage(`Volume ${vol}`);
                setPlayerUpdateTrigger((prev) => prev + 1);
                setTimeout(() => setMessage(""), 2000);
              })
              .catch((error) => {
                console.error("Failed to set volume:", error);
              });
          }
        }
        setCommandMode(false);
        setCommand("");
      } else if (key.escape) {
        setCommandMode(false);
        setCommand("");
      } else if (key.backspace || key.delete) {
        setCommand((prev) => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta && input !== ":") {
        setCommand((prev) => prev + input);
      }
      return;
    }

    if (searchMode) {
      if (key.return) {
        // Execute search
        const query = search.trim();
        if (query) {
          const searchLayerId = String(layerIdCounter++);
          setLayers([
            {
              id: searchLayerId,
              items: [],
              selectedIndex: 0,
              loadingMessage: "loading...",
            },
          ]);
          setActiveLayerIndex(0);

          CiderAPI.search(query, 20)
            .then((items) => {
              setLayers([
                {
                  id: searchLayerId,
                  items: items.map(
                    (item): MusicItem => ({
                      id: item.id,
                      label: `${item.icon}  ${item.label}`,
                      type: item.type,
                      icon: item.icon,
                      rawData: item.rawData,
                      isPlayable: item.isPlayable,
                    })
                  ),
                  selectedIndex: 0,
                  loadingMessage: undefined,
                },
              ]);
            })
            .catch((error) => {
              console.error("Search failed:", error);
              setLayers([
                {
                  id: searchLayerId,
                  items: [
                    {
                      id: "error",
                      label: "Search failed...",
                      type: "songs",
                      icon: "󰀨",
                      rawData: null,
                    },
                  ],
                  selectedIndex: 0,
                  loadingMessage: undefined,
                },
              ]);
            })
            .finally(() => {
              setLoading(false);
            });
        }
        setSearchMode(false);
        setSearch("");
      } else if (key.escape) {
        setSearchMode(false);
        setSearch("");
      } else if (key.backspace || key.delete) {
        setSearch((prev) => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta && !key.tab) {
        setSearch((prev) => prev + input);
      }
      return;
    }

    // CRITICAL: Check for special keys BEFORE any other processing
    // This prevents unnecessary re-renders on random input
    const isSpecialKey =
      input === ":" ||
      input === " " ||
      key.tab ||
      key.upArrow ||
      key.downArrow ||
      key.rightArrow ||
      key.leftArrow ||
      key.backspace ||
      key.delete;

    // Handle global playback controls
    if (key.ctrl) {
      if (key.leftArrow) {
        // Previous using virtual queue
        const prevIndex = QueueService.getPreviousIndex();
        if (prevIndex === null) {
          return;
        }

        QueueService.updateCurrentIndex(prevIndex);
        const track = QueueService.getCurrentTrack();

        if (!track) {
          return;
        }

        requestTrackChange(track.id, "songs");
        return;
      } else if (key.rightArrow) {
        // Next using virtual queue
        Promise.all([PlayerAPI.getShuffleMode(), PlayerAPI.getRepeatMode()])
          .then(([shuffle, repeat]) => {
            const nextIndex = QueueService.getNextIndex(shuffle, repeat);
            if (nextIndex === null) {
              return null;
            }

            QueueService.updateCurrentIndex(nextIndex);
            const track = QueueService.getCurrentTrack();

            if (!track) {
              return null;
            }

            requestTrackChange(track.id, "songs");
            return track;
          })
          .catch((error) => {
            console.error("Failed to get next track:", error);
          });
        return;
      } else if (input === "s" || input === "S" || input === "\x13") {
        PlayerAPI.toggleShuffle()
          .then(() => {
            setPlayerUpdateTrigger((prev) => prev + 1);
          })
          .catch((error) => {
            console.error("Failed to toggle shuffle:", error);
          });
        return;
      } else if (input === "r" || input === "R" || input === "\x12") {
        PlayerAPI.toggleRepeat()
          .then(() => {
            setPlayerUpdateTrigger((prev) => prev + 1);
          })
          .catch((error) => {
            console.error("Failed to toggle repeat:", error);
          });
        return;
      } else if (input === "a" || input === "A" || input === "\x01") {
        PlayerAPI.toggleAutoPlay()
          .then(() => {
            setPlayerUpdateTrigger((prev) => prev + 1);
          })
          .catch((error) => {
            console.error("Failed to toggle autoplay:", error);
          });
        return;
      } else if (key.upArrow || input === "+") {
        // Volume up by 5%
        fetch("http://localhost:10767/api/v1/playback/volume")
          .then((res) => res.json())
          .then((data: any) => {
            const currentVol = data.volume || 0;
            const newVol = Math.min(1, currentVol + 0.05);
            return PlayerAPI.setVolume(newVol);
          })
          .then(() => {
            setPlayerUpdateTrigger((prev) => prev + 1);
          })
          .catch((error) => {
            console.error("Failed to increase volume:", error);
          });
        return;
      } else if (key.downArrow || input === "-") {
        // Volume down by 5%
        fetch("http://localhost:10767/api/v1/playback/volume")
          .then((res) => res.json())
          .then((data: any) => {
            const currentVol = data.volume || 0;
            const newVol = Math.max(0, currentVol - 0.05);
            return PlayerAPI.setVolume(newVol);
          })
          .then(() => {
            setPlayerUpdateTrigger((prev) => prev + 1);
          })
          .catch((error) => {
            console.error("Failed to decrease volume:", error);
          });
        return;
      }
    }

    // Space for play/pause
    if (input === " ") {
      PlayerAPI.playPause()
        .then(() => {
          setPlayerUpdateTrigger((prev) => prev + 1);
        })
        .catch((error) => {
          console.error("Failed to play/pause:", error);
        });
      return;
    }

    if (!isSpecialKey) {
      // Ignore all other input completely
      return;
    }

    // Check for mode switches
    if (input === ":") {
      setCommandMode(true);
      setCommand("");
      return;
    }

    if (key.tab) {
      setSearchMode(true);
      setSearch("");
      return;
    }

    if (key.rightArrow) {
      // Handle navigation to the right
      const currentLayer = layers[activeLayerIndex];
      if (!currentLayer || currentLayer.items.length === 0) return;

      const selectedItem = currentLayer.items[currentLayer.selectedIndex];
      if (!selectedItem) return;

      const itemType = selectedItem.type;
      const itemId = selectedItem.id;

      // Check if it's a song (not a category)
      if (itemType === "songs" && !selectedItem.rawData?.isTopTracks) {
        // Check if the track is playable
        if (selectedItem.isPlayable === false) {
          setMessage("This track is not available");
          setTimeout(() => setMessage(""), 2000);
          return;
        }

        // Determine if we're in a list context
        if (activeLayerIndex >= 1) {
          // We're in Layer 2+ (inside album/playlist/top tracks)
          const parentLayer = layers[activeLayerIndex];
          const allTracks = parentLayer.items.filter(
            (item) => item.type === "songs" && item.isPlayable !== false
          );
          const trackIndex = allTracks.findIndex((t) => t.id === itemId);

          if (allTracks.length > 1 && trackIndex !== -1) {
            // Set up queue with all playable tracks
            const sourceType =
              layers[activeLayerIndex - 1]?.items[
                layers[activeLayerIndex - 1]?.selectedIndex
              ]?.type;
            QueueService.setQueue(allTracks, trackIndex, {
              type:
                sourceType === "albums"
                  ? "album"
                  : sourceType === "playlists"
                  ? "playlist"
                  : "top-tracks",
              id: layers[activeLayerIndex - 1]?.items[
                layers[activeLayerIndex - 1]?.selectedIndex
              ]?.id,
            });
          } else {
            // Single track
            QueueService.setSingleTrack(selectedItem);
          }
        } else {
          // Layer 1 - single track
          QueueService.setSingleTrack(selectedItem);
        }

        // Play the selected track
        requestTrackChange(itemId, "songs");
        return;
      }

      // Check if it's a station - play immediately without creating layer
      if (itemType === "stations") {
        requestTrackChange(itemId, "station");
        return;
      }

      // For other types, check layer limit
      if (layers.length >= MAX_LAYERS) return;

      // Create loading layer immediately
      const loadingLayerId = String(layerIdCounter++);
      const nextLayerIndex = layers.length;

      setLayers((prev) => [
        ...prev,
        {
          id: loadingLayerId,
          items: [],
          selectedIndex: 0,
          loadingMessage: "loading...",
        },
      ]);
      setActiveLayerIndex(nextLayerIndex);

      // Load next layer content
      const loadNextLayer = async () => {
        try {
          let newItems: MusicItem[] = [];

          if (itemType === "songs") {
            // Must be Top Tracks category
            if (selectedItem.rawData?.isTopTracks) {
              const artistId = selectedItem.rawData.artistId;
              newItems = await CiderAPI.getArtistTopTracks(
                artistId,
                nextLayerIndex
              );
            }
          } else if (itemType === "albums") {
            // Check if it's Albums category
            if (selectedItem.rawData?.isAlbumsCategory) {
              const artistId = selectedItem.rawData.artistId;
              newItems = await CiderAPI.getArtistAlbums(
                artistId,
                nextLayerIndex
              );
            } else {
              // Regular album - load tracks
              newItems = await CiderAPI.getAlbumTracks(itemId, nextLayerIndex);
            }
          } else if (itemType === "playlists") {
            newItems = await CiderAPI.getPlaylistTracks(itemId, nextLayerIndex);
          } else if (itemType === "artists") {
            newItems = await CiderAPI.getArtistContent(itemId);
          }

          // Update the loading layer with actual data
          setLayers((prev) => {
            const newLayers = [...prev];
            const loadingLayerIdx = newLayers.findIndex(
              (l) => l.id === loadingLayerId
            );
            if (loadingLayerIdx !== -1) {
              newLayers[loadingLayerIdx] = {
                ...newLayers[loadingLayerIdx],
                items: newItems.map(
                  (item): MusicItem => ({
                    id: item.id,
                    label: `${item.icon}  ${item.label}`,
                    type: item.type,
                    icon: item.icon,
                    rawData: item.rawData,
                    isPlayable: item.isPlayable,
                  })
                ),
                loadingMessage: undefined,
              };
            }
            return newLayers;
          });
        } catch (error) {
          console.error("Failed to load next layer:", error);
          // Update with error message
          setLayers((prev) => {
            const newLayers = [...prev];
            const loadingLayerIdx = newLayers.findIndex(
              (l) => l.id === loadingLayerId
            );
            if (loadingLayerIdx !== -1) {
              newLayers[loadingLayerIdx] = {
                ...newLayers[loadingLayerIdx],
                items: [
                  {
                    id: "error",
                    label: "Error loading...",
                    type: "songs",
                    icon: "󰀨",
                    rawData: null,
                  },
                ],
                loadingMessage: undefined,
              };
            }
            return newLayers;
          });
        }
      };

      loadNextLayer();
    } else if (key.leftArrow || key.backspace || key.delete) {
      // Remove active layer (go back)
      if (layers.length > 1) {
        setLayers((prev) => {
          const newLayers = [...prev];
          newLayers.splice(activeLayerIndex, 1);
          return newLayers;
        });
        setActiveLayerIndex((prev) => Math.max(0, prev - 1));
      }
    } else if (key.upArrow) {
      // Move selection up
      setLayers((prev) => {
        const currentLayer = prev[activeLayerIndex];
        if (!currentLayer || currentLayer.selectedIndex <= 0) return prev;
        
        const newLayers = [...prev];
        newLayers[activeLayerIndex] = {
          ...currentLayer,
          selectedIndex: currentLayer.selectedIndex - 1,
        };
        return newLayers;
      });
    } else if (key.downArrow) {
      // Move selection down
      setLayers((prev) => {
        const currentLayer = prev[activeLayerIndex];
        if (!currentLayer || currentLayer.selectedIndex >= currentLayer.items.length - 1) return prev;
        
        const newLayers = [...prev];
        newLayers[activeLayerIndex] = {
          ...currentLayer,
          selectedIndex: currentLayer.selectedIndex + 1,
        };
        return newLayers;
      });
    }
  });

  // Calculate player dimensions
  const commandBarHeight = 3;

  const playerWidthNarrow = terminalSize.width;
  const playerHeightNarrow = Math.floor((playerWidthNarrow * 9) / 40);
  const browserHeightNarrow =
    terminalSize.height - playerHeightNarrow - commandBarHeight;
  const browserHeightWide = terminalSize.height - commandBarHeight;
  const playerWidthWide = Math.floor(terminalSize.width * 0.35);
  const artSizeWide = Math.floor(playerWidthWide / 2) - 4;
  const artSizeNarrow = playerHeightNarrow * 2;

  return (
    <TerminalInfoProvider>
      <Box
        flexDirection="column"
        width={terminalSize.width}
        height={terminalSize.height}
      >
        <Box
          flexDirection={isWide ? "row" : "column-reverse"}
          flexGrow={1}
          overflow="hidden"
        >
          {/* Browser */}
          <Box
            width={isWide ? "65%" : "100%"}
            flexGrow={isWide ? 0 : 1}
            overflow="hidden"
          >
            <Browser
              layers={layers}
              activeLayerIndex={activeLayerIndex}
              terminalWidth={
                isWide
                  ? Math.floor(terminalSize.width * 0.65)
                  : terminalSize.width
              }
              terminalHeight={isWide ? browserHeightWide : browserHeightNarrow}
              isWide={isWide}
              search={search}
              isSearchFocused={searchMode}
              nowPlayingId={nowPlayingId}
            />
          </Box>

          {/* Player */}
          <Box
            width={isWide ? "35%" : "100%"}
            height={isWide ? undefined : playerHeightNarrow}
            flexGrow={isWide ? 1 : 0}
            flexShrink={0}
            overflow="hidden"
          >
           <Player
              isWide={isWide}
              artSize={isWide ? artSizeWide : artSizeNarrow}
              updateTrigger={playerUpdateTrigger}
              nowPlayingId={nowPlayingId}
            />
          </Box>
        </Box>

        {/* Command Bar */}
        <CommandBar
          command={message || command}
          isFocused={commandMode || message !== ""}
        />
      </Box>
    </TerminalInfoProvider>
  );
};
