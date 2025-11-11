import React, { useState } from "react";
import { Box, Text } from "ink";
import { Layer } from "./Layer";
import { SearchBar } from "./SearchBar";

interface Item {
  id: string;
  label: string;
}

interface LayerData {
  id: string;
  items: Item[];
  selectedIndex: number;
}

interface BrowserProps {
  layers: LayerData[];
  activeLayerIndex: number;
  terminalWidth: number;
  terminalHeight: number;
  isWide: boolean;
  search: string;
  isSearchFocused: boolean;
}

export const Browser: React.FC<BrowserProps> = ({
  layers,
  activeLayerIndex,
  terminalWidth,
  terminalHeight,
  isWide,
  search,
  isSearchFocused,
}) => {
  const closedCount = layers.length - 1;
  const closedWidthPercent = 20;

  // Total available width for all layers
  const totalWidth = terminalWidth;

  const calculateWidth = (index: number): number => {
    const isActive = index === activeLayerIndex;

    if (isActive) {
      // Active layer gets remaining space
      const closedTotalWidth =
        closedCount * Math.floor((totalWidth * closedWidthPercent) / 100);
      return totalWidth - closedTotalWidth;
    } else {
      // Closed layer gets fixed percentage
      return Math.floor((totalWidth * closedWidthPercent) / 100);
    }
  };

  // Calculate available height for layers (subtract search bar height)
  const searchBarHeight = 3;
  const layerHeight = terminalHeight - searchBarHeight;

  return (
    <Box flexDirection="column" height="100%" width="100%" overflow="hidden">
      {/* Search Bar */}
      <Box marginRight={isWide ? 1 : 0} flexShrink={0}>
        <SearchBar search={search} isFocused={isSearchFocused} />
      </Box>

      {/* Lists Container */}
      <Box flexDirection="row" flexGrow={1} width="100%" overflow="hidden">
        {layers.map((layer, index) => (
          <Layer
            key={layer.id}
            items={layer.items}
            selectedIndex={layer.selectedIndex}
            isActive={index === activeLayerIndex}
            isClosed={index !== activeLayerIndex}
            width={calculateWidth(index)}
            height={layerHeight}
          />
        ))}
      </Box>
    </Box>
  );
};
