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
import { playbackStateService } from "./services/playbackState.js";

import fs from "fs";

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
  const [isPlayingStation, setIsPlayingStation] = useState(false);
  const [nowPlayingTrackInStationId, setNowPlayingTrackInStationId] = useState<
    string | null
  >(null);
  const [isStationOperationLocked, setIsStationOperationLocked] =
    useState(false);
  const [currentStationId, setCurrentStationId] = useState<string | null>(null);

  // Use ref for isChangingTrack to avoid stale closures and ensure consistency
  const isChangingTrackRef = useRef(false);
  const trackChangeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const stationTrackFetchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const setIsChangingTrack = (value: boolean) => {
    isChangingTrackRef.current = value;
  };

  // Debounced track change handler - ensures only final change within 500ms is executed
  const requestTrackChange = (trackId: string, trackType: string = "songs") => {
    // Track if we're starting to play a station
    const isStation = trackType === "stations";
    setIsPlayingStation(isStation);

    // For stations: set nowPlayingId to station ID (for highlighting [Station] item)
    // For regular tracks: set nowPlayingId to track ID (for highlighting [track] item)
    setNowPlayingId(trackId);

    // For stations: check if operation is locked
    if (isStation) {
      if (isStationOperationLocked) {
        setMessage("Switching...");
        setTimeout(() => setMessage(""), 1000);
        return;
      }

      // Check if this is a different station (need to stop first)
      const isDifferentStation = currentStationId !== trackId;

      // Lock station operations
      setIsStationOperationLocked(true);

      // Capture current track ID BEFORE sending request
      const trackIdBeforeSend = nowPlayingTrackInStationId;

      // If switching to a different station or first time, stop current playback first
      if (isDifferentStation) {
        PlayerAPI.stop()
          .then(() => {
            // Update current station ID
            setCurrentStationId(trackId);
            // Clear previous track ID since we're entering a new station
            setNowPlayingTrackInStationId(null);
            // Now play the new station
            return CiderAPI.playItem(trackId, trackType);
          })
          .then(() => {
            // Start polling with null as previous track (first time in this station)
            pollForStationTrackChange(null);
          })
          .catch(() => {
            setMessage("Cannot play this station");
            setTimeout(() => setMessage(""), 2000);
            setIsStationOperationLocked(false);
          });
      } else {
        // Same station, just play the item
        CiderAPI.playItem(trackId, trackType)
          .then(() => {
            // Start polling for track change, passing the captured ID
            pollForStationTrackChange(trackIdBeforeSend);
          })
          .catch(() => {
            setMessage("Cannot play this track");
            setTimeout(() => setMessage(""), 2000);
            setIsStationOperationLocked(false);
          });
      }

      return;
    }

    // For regular tracks: clear station state and use existing debounce logic
    setIsPlayingStation(false);
    setCurrentStationId(null);
    setNowPlayingTrackInStationId(null);

    // Clear any pending track change request
    if (trackChangeDebounceRef.current) {
      clearTimeout(trackChangeDebounceRef.current);
      trackChangeDebounceRef.current = null;
    }

    // Mark as changing track
    setIsChangingTrack(true);

    // Buffer: Wait 500ms to ensure this is the final change
    // Only the last change within 500ms window will execute play and update Player UI
    trackChangeDebounceRef.current = setTimeout(async () => {
      // Execute play request for the final track ID
      try {
        await CiderAPI.playItem(trackId, trackType);
      } catch (error) {
        setMessage("Cannot play this track");
        setTimeout(() => setMessage(""), 2000);
        setIsChangingTrack(false);
        trackChangeDebounceRef.current = null;
        return;
      }

      // Reset changing track flag
      setIsChangingTrack(false);

      // Trigger player info refresh
      setPlayerUpdateTrigger((prev) => prev + 1);

      trackChangeDebounceRef.current = null;
    }, 500);
  };

  // Poll for station track change until track ID changes or timeout
  const pollForStationTrackChange = (trackIdBeforeOperation: string | null) => {
    // Clear any pending fetch
    if (stationTrackFetchDebounceRef.current) {
      clearTimeout(stationTrackFetchDebounceRef.current);
      stationTrackFetchDebounceRef.current = null;
    }

    const startTime = Date.now();
    const maxWaitTime = 10000; // Maximum 10 seconds (safety timeout)
    const pollInterval = 500; // Check every 500ms
    let hasFoundNewTrack = false;

    const poll = async () => {
      try {
        const nowPlaying = await PlayerAPI.getNowPlaying();
        const currentTrackId = nowPlaying?.info?.playParams?.id;

        if (!currentTrackId) {
          // No track info yet, keep polling
          const elapsed = Date.now() - startTime;
          if (elapsed >= maxWaitTime) {
            setIsStationOperationLocked(false);
            setMessage("Timeout - no track info");
            setTimeout(() => setMessage(""), 2000);
            return;
          }

          setMessage("Switching...");
          stationTrackFetchDebounceRef.current = setTimeout(poll, pollInterval);
          return;
        }

        // Success conditions:
        // 1. First time playing station (trackIdBeforeOperation is null) - accept any valid track
        // 2. Track has changed (currentTrackId different from trackIdBeforeOperation)
        const isFirstPlay = trackIdBeforeOperation === null;
        const hasTrackChanged = currentTrackId !== trackIdBeforeOperation;

        if (isFirstPlay || hasTrackChanged) {
          hasFoundNewTrack = true;
          setNowPlayingTrackInStationId(currentTrackId);
          setPlayerUpdateTrigger((prev) => prev + 1);
          setIsStationOperationLocked(false);
          setMessage("");
          return;
        }

        // Track hasn't changed yet, check timeout
        const elapsed = Date.now() - startTime;
        if (elapsed >= maxWaitTime) {
          // Timeout: force unlock but don't update (track didn't actually change)
          setIsStationOperationLocked(false);
          setMessage("Timeout - track unchanged");
          setTimeout(() => setMessage(""), 2000);
          return;
        }

        // Continue polling
        setMessage("Switching...");
        stationTrackFetchDebounceRef.current = setTimeout(poll, pollInterval);
      } catch (error) {
        console.error("Failed to poll station track:", error);
        setIsStationOperationLocked(false);
        setMessage("Error polling track");
        setTimeout(() => setMessage(""), 2000);
      }
    };

    // Start polling immediately
    poll();
  };

  // Auto-play handler: create station from recent tracks
  const handleAutoPlay = async () => {
    const autoplay = playbackStateService.getAutoPlayMode();
    const repeat = playbackStateService.getRepeatMode();

    if (!autoplay || repeat !== 0) {
      // No autoplay or repeat is on: stop and clear
      await PlayerAPI.stop();
      setNowPlayingId(null);
      QueueService.clearQueue();
      return;
    }

    // Auto-play enabled: Create station from recently played tracks
    try {
      setMessage("Creating station from recent tracks...");

      // Get last 5 played tracks (or less if queue is smaller)
      const recentTracks = QueueService.getRecentlyPlayedTracks(5);

      if (recentTracks.length > 0) {
        // Extract track IDs
        const trackIds = recentTracks.map((track) => track.id);

        // Create station with multiple seeds
        const stationId = await CiderAPI.createStationFromSongs(trackIds);

        if (stationId) {
          setMessage(`Auto-playing station from ${trackIds.length} tracks...`);

          // Clear the old queue
          QueueService.clearQueue();

          // Play the station using existing station logic
          requestTrackChange(stationId, "stations");

          setTimeout(() => setMessage(""), 2000);
        } else {
          setMessage("Failed to create station");
          await PlayerAPI.stop();
          setNowPlayingId(null);
          QueueService.clearQueue();
          setTimeout(() => setMessage(""), 2000);
        }
      } else {
        // No tracks to create station from
        setMessage("No recent tracks for auto-play");
        await PlayerAPI.stop();
        setNowPlayingId(null);
        QueueService.clearQueue();
        setTimeout(() => setMessage(""), 2000);
      }
    } catch (error) {
      console.error("Auto-play failed:", error);
      setMessage("Auto-play failed");
      await PlayerAPI.stop();
      setNowPlayingId(null);
      QueueService.clearQueue();
      setTimeout(() => setMessage(""), 2000);
    }
  };

  // Station navigation handler - lock/unlock mechanism with polling
  const handleStationNavigation = async (direction: "next" | "previous") => {
    // Check if locked
    if (isStationOperationLocked) {
      setMessage("Switching...");
      setTimeout(() => setMessage(""), 1000);
      return;
    }

    // Lock operations
    setIsStationOperationLocked(true);

    // Capture current track ID BEFORE sending request
    const trackIdBeforeSend = nowPlayingTrackInStationId;

    try {
      // Send navigation request immediately
      if (direction === "next") {
        await PlayerAPI.next();
      } else {
        await PlayerAPI.previous();
      }

      // Start polling for track change, passing the captured ID
      pollForStationTrackChange(trackIdBeforeSend);
    } catch (error) {
      console.error(`Failed to go to ${direction} track:`, error);
      setIsStationOperationLocked(false);
      setMessage("");
    }
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
    // Stop any current playback in Cider to avoid state conflicts
    PlayerAPI.stop().catch(() => {
      // Silently fail if stop fails (e.g., nothing was playing)
    });

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
    let lastIsPlaying = true;
    let lastTrackId: string | null = null;
    let shouldPoll = false;
    let pollInterval: NodeJS.Timeout | null = null;

    const unsubscribe = SocketService.onPlayback(async (data) => {
      // Skip for stations - Cider handles station playlist automatically
      if (isPlayingStation) {
        return;
      }

      const currentTime = (data.currentPlaybackTime || 0) * 1000; // Convert seconds to milliseconds
      const duration = data.durationInMillis || 0;
      const progress = duration > 0 ? currentTime / duration : 0;
      const currentTrackId = data.trackId || null;

      // Detect track change (new track started playing)
      if (currentTrackId && currentTrackId !== lastTrackId) {
        lastTrackId = currentTrackId;
        lastIsPlaying = true;
        shouldPoll = false;

        // Stop polling when new track starts
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }

      // Start polling when track reaches 95%
      if (progress >= 0.95 && !shouldPoll && duration > 0) {
        shouldPoll = true;

        // Start polling Cider playback status to detect when track ends
        pollInterval = setInterval(async () => {
          if (isPlayingStation) {
            return;
          }

          try {
            const response = await fetch(
              "http://localhost:10767/api/v1/playback/now-playing"
            );
            if (!response.ok) {
              return;
            }

            const result: any = await response.json();
            const isPlaying =
              result.info?.currentPlaybackTime !== undefined &&
              result.info?.currentPlaybackTime > 0;

            // Detect transition from playing to stopped (track ended)
            if (lastIsPlaying && !isPlaying) {
              lastIsPlaying = false;

              // Stop polling
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }

              // Use the same logic as manual next track (Ctrl+RightArrow)
              const shuffle = playbackStateService.getShuffleMode();
              const repeat = playbackStateService.getRepeatMode();
              const nextIndex = QueueService.getNextIndex(shuffle, repeat);

              if (nextIndex === null) {
                // No next track - trigger auto-play
                handleAutoPlay().catch((error) => {
                  console.error("Auto-play failed:", error);
                });
                return;
              }

              QueueService.updateCurrentIndex(nextIndex);
              const track = QueueService.getCurrentTrack();

              if (!track) {
                return;
              }

              // Update UI immediately for auto-next
              setNowPlayingId(track.id);
              setPlayerUpdateTrigger((prev) => prev + 1);

              requestTrackChange(track.id, "songs");
            } else if (isPlaying) {
              lastIsPlaying = true;
            }
          } catch (error) {
            // Ignore fetch errors
          }
        }, 500);
      }
    });

    return () => {
      unsubscribe();
      if (pollInterval) {
        clearInterval(pollInterval);
      }
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
        } else if (
          command.startsWith("vol ") ||
          command.startsWith("volume ")
        ) {
          const arg = command.startsWith("vol ")
            ? command.substring(4)
            : command.substring(7);
          const vol = parseInt(arg.trim(), 10);
          if (!isNaN(vol) && vol >= 0 && vol <= 100) {
            PlayerAPI.setVolume(vol / 100)
              .then(() => {
                setMessage(`Volume set to ${vol}`);
                setPlayerUpdateTrigger((prev) => prev + 1);
                setTimeout(() => setMessage(""), 2000);
              })
              .catch((error) => {
                console.error("Failed to set volume:", error);
              });
          }
        } else if (command.startsWith("seek ")) {
          const timeStr = command.substring(5).trim();
          // Parse time format: "1,28" or "88" (seconds)
          let seconds = 0;
          if (timeStr.includes(",")) {
            const parts = timeStr.split(",");
            const minutes = parseInt(parts[0]) || 0;
            const secs = parseInt(parts[1]) || 0;
            seconds = minutes * 60 + secs;
          } else {
            seconds = parseInt(timeStr) || 0;
          }

          if (seconds >= 0) {
            PlayerAPI.seek(seconds)
              .then(() => {
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                setMessage(
                  `Seek to ${mins}:${secs.toString().padStart(2, "0")}`
                );
                setPlayerUpdateTrigger((prev) => prev + 1);
                setTimeout(() => setMessage(""), 2000);
              })
              .catch((error) => {
                console.error("Failed to seek:", error);
                setMessage("Seek failed");
                setTimeout(() => setMessage(""), 2000);
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
        // Station: use Cider's previous API with throttle and buffer
        if (isPlayingStation) {
          handleStationNavigation("previous");
          return;
        }

        // Regular tracks: use virtual queue
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
        // Station: use Cider's next API with throttle and buffer
        if (isPlayingStation) {
          handleStationNavigation("next");
          return;
        }

        // Regular tracks: use virtual queue
        const shuffle = playbackStateService.getShuffleMode();
        const repeat = playbackStateService.getRepeatMode();
        const nextIndex = QueueService.getNextIndex(shuffle, repeat);

        if (nextIndex === null) {
          // No next track - trigger auto-play
          handleAutoPlay().catch((error) => {
            console.error("Auto-play failed:", error);
          });
          return;
        }

        QueueService.updateCurrentIndex(nextIndex);
        const track = QueueService.getCurrentTrack();

        if (!track) {
          return;
        }

        requestTrackChange(track.id, "songs");
        return;
      } else if (input === "s" || input === "S" || input === "\x13") {
        playbackStateService.toggleShuffle();
        setPlayerUpdateTrigger((prev) => prev + 1);
        return;
      } else if (input === "r" || input === "R" || input === "\x12") {
        playbackStateService.toggleRepeat();
        setPlayerUpdateTrigger((prev) => prev + 1);
        return;
      } else if (input === "a" || input === "A" || input === "\x01") {
        playbackStateService.toggleAutoPlay();
        setPlayerUpdateTrigger((prev) => prev + 1);
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
        requestTrackChange(itemId, "stations");
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
        if (
          !currentLayer ||
          currentLayer.selectedIndex >= currentLayer.items.length - 1
        )
          return prev;

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
              nowPlayingId={
                isPlayingStation ? nowPlayingTrackInStationId : nowPlayingId
              }
              isPlayingStation={isPlayingStation}
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
