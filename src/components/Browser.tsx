import React, { useState } from "react";
import { Box, Text } from "ink";
import { Layer } from "./Layer";

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
}

export const Browser: React.FC<BrowserProps> = ({
  layers,
  activeLayerIndex,
  terminalWidth,
  terminalHeight,
  isWide,
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
      <Box
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        height={searchBarHeight}
        flexShrink={0}
        marginRight={isWide ? 1 : 0}
      >
        <Text color="gray"> Search Here...</Text>
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
