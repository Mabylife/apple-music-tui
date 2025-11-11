import React, { useState, useEffect } from "react";
import { Box, useInput, useApp, useStdout } from "ink";
import { Browser } from "./components/Browser";
import { Player } from "./components/Player";
import { CommandBar } from "./components/CommandBar";

interface Item {
  id: string;
  label: string;
}

interface LayerData {
  id: string;
  items: Item[];
  selectedIndex: number;
}

const MAX_LAYERS = 4;

const generateItems = (count: number, prefix: string): Item[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    label: `${prefix} Item ${i + 1}`,
  }));
};

let layerIdCounter = 0;

export const App: React.FC = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [layers, setLayers] = useState<LayerData[]>([
    {
      id: String(layerIdCounter++),
      items: generateItems(20, "Initial"),
      selectedIndex: 0,
    },
  ]);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [terminalSize, setTerminalSize] = useState({
    width: stdout.columns || 100,
    height: stdout.rows || 30,
  });
  const [commandMode, setCommandMode] = useState(false);
  const [command, setCommand] = useState("");

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
    if (commandMode) {
      if (key.return) {
        // Execute command
        if (command === "q" || command === "quit") {
          exit();
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

    if (input === ":") {
      setCommandMode(true);
      setCommand("");
      return;
    }

    if (input === "q") {
      exit();
      return;
    }

    if (key.rightArrow) {
      // Add layer to the right
      if (layers.length < MAX_LAYERS) {
        const layerNumber = layers.length + 1;
        const newLayer = {
          id: String(layerIdCounter),
          items: generateItems(15, `Layer ${layerNumber}`),
          selectedIndex: 0,
        };
        layerIdCounter++;
        setLayers((prev) => [...prev, newLayer]);
        setActiveLayerIndex((prev) => prev + 1);
      }
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
        const newLayers = [...prev];
        const currentLayer = newLayers[activeLayerIndex];
        if (currentLayer) {
          currentLayer.selectedIndex = Math.max(
            0,
            currentLayer.selectedIndex - 1
          );
        }
        return newLayers;
      });
    } else if (key.downArrow) {
      // Move selection down
      setLayers((prev) => {
        const newLayers = [...prev];
        const currentLayer = newLayers[activeLayerIndex];
        if (currentLayer) {
          currentLayer.selectedIndex = Math.min(
            currentLayer.items.length - 1,
            currentLayer.selectedIndex + 1
          );
        }
        return newLayers;
      });
    }
  });

  // Calculate player dimensions
  const commandBarHeight = 3;

  // Terminal cells are usually 1:2 ratio (width:height in pixels)
  // So to get visual 20:9 ratio, we need different cell count ratio

  // For narrow mode: Player should be 20:9 aspect ratio VISUALLY
  // Visual ratio: width:height = 20:9
  // Since each cell is 1:2 (width:height), we need:
  // (cells_width × 1) : (cells_height × 2) = 20 : 9
  // cells_width : cells_height = 20 : 4.5 = 40 : 9
  const playerWidthNarrow = terminalSize.width; // full width (e.g., 80)
  const playerHeightNarrow = Math.floor((playerWidthNarrow * 9) / 40); // e.g., 80 → 18 cells (visually 20:9)

  // Browser height for narrow mode
  const browserHeightNarrow =
    terminalSize.height - playerHeightNarrow - commandBarHeight;
  const browserHeightWide = terminalSize.height - commandBarHeight;

  // Calculate art size (1:1 ratio - always VISUALLY square)

  // Wide mode: Art width is 100% of player inner width, height for visual square
  // Visual square: art_visual_width = art_visual_height
  // (art_width_cells × 1) = (art_height_cells × 2)
  // art_height_cells = art_width_cells / 2
  // Need to reduce slightly to account for borders
  const playerWidthWide = Math.floor(terminalSize.width * 0.35);
  const artSizeWide = Math.floor(playerWidthWide / 2) - 4; // Reduce by 4 for borders

  // Narrow mode: Art height is 100% of player inner height, width for visual square
  // Visual square: art_visual_width = art_visual_height
  // (art_width_cells × 1) = (art_height_cells × 2)
  // art_width_cells = art_height_cells × 2
  const artSizeNarrow = playerHeightNarrow * 2; // Simple: player height × 2

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
                ? Math.floor(terminalSize.width * 0.65) // Don't subtract, let Browser handle it
                : terminalSize.width // Don't subtract, let Browser handle it
            }
            terminalHeight={isWide ? browserHeightWide : browserHeightNarrow}
            isWide={isWide}
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
          />
        </Box>
      </Box>

      {/* Command Bar */}
      <CommandBar command={command} isFocused={commandMode} />
    </Box>
  );
};
