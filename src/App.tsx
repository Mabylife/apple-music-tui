import React, { useState, useEffect } from "react";
import { Box, useInput, useApp, useStdout } from "ink";
import { Browser } from "./components/Browser.js";
import { Player } from "./components/Player.js";
import { CommandBar } from "./components/CommandBar.js";
import { SearchBar } from "./components/SearchBar.js";
import { CiderAPI, MusicItem } from "./services/api.js";
import { PlayerAPI } from "./services/player.js";

interface Item {
  id: string;
  label: string;
  type?: string;
  rawData?: any;
}

interface LayerData {
  id: string;
  items: Item[];
  selectedIndex: number;
}

const MAX_LAYERS = 4;

let layerIdCounter = 0;

export const App: React.FC = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [layers, setLayers] = useState<LayerData[]>([]);
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

  // Load recommendations function
  const loadRecommendations = async () => {
    try {
      const items = await CiderAPI.getRecommendations(10);
      setLayers([
        {
          id: String(layerIdCounter++),
          items: items.map((item) => ({
            id: item.id,
            label: `${item.icon}  ${item.label}`,
            type: item.type,
            rawData: item.rawData,
          })),
          selectedIndex: 0,
        },
      ]);
    } catch (error) {
      console.error("Failed to load recommendations:", error);
      setLayers([
        {
          id: String(layerIdCounter++),
          items: [{ id: "error", label: "Error loading...", type: "error" }],
          selectedIndex: 0,
        },
      ]);
    }
  };

  // Load recommendations on mount
  useEffect(() => {
    loadRecommendations();
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
          loadRecommendations();
        } else if (command === "stop") {
          PlayerAPI.stop().then(() => {
            setPlayerUpdateTrigger(prev => prev + 1);
          }).catch((error) => {
            console.error("Failed to stop:", error);
          });
        } else if (command.startsWith("vol ")) {
          const vol = parseInt(command.substring(4));
          if (!isNaN(vol) && vol >= 0 && vol <= 100) {
            PlayerAPI.setVolume(vol / 100).then(() => {
              setMessage(`Volume ${vol}`);
              setPlayerUpdateTrigger(prev => prev + 1);
              setTimeout(() => setMessage(""), 2000);
            }).catch((error) => {
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
          setLoading(true);
          CiderAPI.search(query, 10)
            .then((items) => {
              setLayers([
                {
                  id: String(layerIdCounter++),
                  items: items.map((item) => ({
                    id: item.id,
                    label: `${item.icon}  ${item.label}`,
                    type: item.type,
                    rawData: item.rawData,
                  })),
                  selectedIndex: 0,
                },
              ]);
              setActiveLayerIndex(0);
            })
            .catch((error) => {
              console.error("Search failed:", error);
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
    const isSpecialKey = input === ":" || input === " " || key.tab || key.upArrow || key.downArrow || key.rightArrow || key.leftArrow || key.backspace || key.delete;
    
    // Handle global playback controls
    if (key.ctrl) {
      if (key.leftArrow) {
        PlayerAPI.previous().then(() => {
          setPlayerUpdateTrigger(prev => prev + 1);
        }).catch((error) => {
          console.error("Failed to go previous:", error);
        });
        return;
      } else if (key.rightArrow) {
        PlayerAPI.next().then(() => {
          setPlayerUpdateTrigger(prev => prev + 1);
        }).catch((error) => {
          console.error("Failed to go next:", error);
        });
        return;
      } else if (input === "s" || input === "S" || input === "\x13") {
        PlayerAPI.toggleShuffle().then(() => {
          setPlayerUpdateTrigger(prev => prev + 1);
        }).catch((error) => {
          console.error("Failed to toggle shuffle:", error);
        });
        return;
      } else if (input === "r" || input === "R" || input === "\x12") {
        PlayerAPI.toggleRepeat().then(() => {
          setPlayerUpdateTrigger(prev => prev + 1);
        }).catch((error) => {
          console.error("Failed to toggle repeat:", error);
        });
        return;
      } else if (key.upArrow || input === "+") {
        // Volume up by 5%
        fetch("http://localhost:10767/api/v1/playback/volume")
          .then(res => res.json())
          .then((data: any) => {
            const currentVol = data.volume || 0;
            const newVol = Math.min(1, currentVol + 0.05);
            return PlayerAPI.setVolume(newVol);
          })
          .then(() => {
            setPlayerUpdateTrigger(prev => prev + 1);
          })
          .catch((error) => {
            console.error("Failed to increase volume:", error);
          });
        return;
      } else if (key.downArrow || input === "-") {
        // Volume down by 5%
        fetch("http://localhost:10767/api/v1/playback/volume")
          .then(res => res.json())
          .then((data: any) => {
            const currentVol = data.volume || 0;
            const newVol = Math.max(0, currentVol - 0.05);
            return PlayerAPI.setVolume(newVol);
          })
          .then(() => {
            setPlayerUpdateTrigger(prev => prev + 1);
          })
          .catch((error) => {
            console.error("Failed to decrease volume:", error);
          });
        return;
      }
    }
    
    // Space for play/pause
    if (input === " ") {
      PlayerAPI.playPause().then(() => {
        setPlayerUpdateTrigger(prev => prev + 1);
      }).catch((error) => {
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

      // Check if it's a song (not a category) - play immediately without creating layer
      if (itemType === "songs" && !selectedItem.rawData?.isTopTracks) {
        CiderAPI.playItem(itemId, "songs").catch((error) => {
          console.error("Failed to play song:", error);
        });
        return;
      }

      // Check if it's a station - play immediately without creating layer
      if (itemType === "stations") {
        CiderAPI.playItem(itemId, "station").catch((error) => {
          console.error("Failed to play station:", error);
        });
        return;
      }

      // For other types, check layer limit
      if (layers.length >= MAX_LAYERS) return;

      // Load next layer content
      const loadNextLayer = async () => {
        try {
          let newItems: MusicItem[] = [];

          if (itemType === "songs") {
            // Must be Top Tracks category
            if (selectedItem.rawData?.isTopTracks) {
              const artistId = selectedItem.rawData.artistId;
              newItems = await CiderAPI.getArtistTopTracks(artistId);
            }
          } else if (itemType === "albums") {
            // Check if it's Albums category
            if (selectedItem.rawData?.isAlbumsCategory) {
              const artistId = selectedItem.rawData.artistId;
              newItems = await CiderAPI.getArtistAlbums(artistId);
            } else {
              // Regular album - load tracks
              newItems = await CiderAPI.getAlbumTracks(itemId);
            }
          } else if (itemType === "playlists") {
            newItems = await CiderAPI.getPlaylistTracks(itemId);
          } else if (itemType === "artists") {
            newItems = await CiderAPI.getArtistContent(itemId);
          }

          if (newItems.length > 0) {
            // Add new layer with loaded data
            setLayers((prev) => [
              ...prev,
              {
                id: String(layerIdCounter++),
                items: newItems.map((item) => ({
                  id: item.id,
                  label: `${item.icon}  ${item.label}`,
                  type: item.type,
                  rawData: item.rawData,
                })),
                selectedIndex: 0,
              },
            ]);
            setActiveLayerIndex((prev) => prev + 1);
          }
        } catch (error) {
          console.error("Failed to load next layer:", error);
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
      const currentLayer = layers[activeLayerIndex];
      if (currentLayer && currentLayer.selectedIndex > 0) {
        setLayers((prev) => {
          const newLayers = [...prev];
          newLayers[activeLayerIndex] = {
            ...currentLayer,
            selectedIndex: currentLayer.selectedIndex - 1,
          };
          return newLayers;
        });
      }
    } else if (key.downArrow) {
      // Move selection down
      const currentLayer = layers[activeLayerIndex];
      if (
        currentLayer &&
        currentLayer.selectedIndex < currentLayer.items.length - 1
      ) {
        setLayers((prev) => {
          const newLayers = [...prev];
          newLayers[activeLayerIndex] = {
            ...currentLayer,
            selectedIndex: currentLayer.selectedIndex + 1,
          };
          return newLayers;
        });
      }
    }
  });

  // Calculate player dimensions
  const commandBarHeight = 3;

  const playerWidthNarrow = terminalSize.width;
  const playerHeightNarrow = Math.floor((playerWidthNarrow * 9) / 40);
  const browserHeightNarrow = terminalSize.height - playerHeightNarrow - commandBarHeight;
  const browserHeightWide = terminalSize.height - commandBarHeight;
  const playerWidthWide = Math.floor(terminalSize.width * 0.35);
  const artSizeWide = Math.floor(playerWidthWide / 2) - 4;
  const artSizeNarrow = playerHeightNarrow * 2;

  return (
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
          />
        </Box>
      </Box>

      {/* Command Bar */}
      <CommandBar command={message || command} isFocused={commandMode || message !== ""} />
    </Box>
  );
};
