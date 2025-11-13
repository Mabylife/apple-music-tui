import React, { useMemo } from "react";
import { Box, Text } from "ink";

interface Item {
  id: string;
  label: string;
  isPlayable?: boolean;
}

interface LayerProps {
  items: Item[];
  selectedIndex: number;
  isActive: boolean;
  isClosed: boolean;
  width: number;
  height: number;
  loadingMessage?: string;
  nowPlayingId?: string | null;
}

export const Layer: React.FC<LayerProps> = ({
  items,
  selectedIndex,
  isActive,
  isClosed,
  width,
  height,
  loadingMessage,
  nowPlayingId,
}) => {
  // Calculate visible items based on height
  // Each item takes 1 line, account for borders (2 lines) and padding
  const maxVisibleItems = Math.max(1, height - 2);

  // Calculate scroll offset to keep selected item visible
  const scrollOffset = useMemo(() => {
    if (items.length <= maxVisibleItems) {
      return 0;
    }

    // Try to center the selected item
    const halfVisible = Math.floor(maxVisibleItems / 2);
    let offset = selectedIndex - halfVisible;

    // Clamp to valid range
    offset = Math.max(0, offset);
    offset = Math.min(items.length - maxVisibleItems, offset);

    return offset;
  }, [selectedIndex, items.length, maxVisibleItems]);

  const visibleItems = items.slice(
    scrollOffset,
    scrollOffset + maxVisibleItems
  );

  return (
    <Box
      width={width}
      height={height}
      borderStyle="single"
      borderColor={isActive ? "gray" : "gray"}
      flexDirection="column"
      paddingX={1}
      overflow="hidden"
    >
      <Box
        flexDirection="column"
        flexGrow={1}
        overflow="hidden"
        width={width - 2}
      >
        {loadingMessage ? (
          // Display loading message
          <Box overflow="hidden">
            <Text color="gray">{loadingMessage}</Text>
          </Box>
        ) : isClosed ? (
          // When closed, show the selected item at its original position
          <>
            {Array.from({ length: selectedIndex - scrollOffset }).map(
              (_, i) => (
                <Box key={`spacer-${i}`} overflow="hidden">
                  <Text> </Text>
                </Box>
              )
            )}
            <Box overflow="hidden">
              {(() => {
                const item = items[selectedIndex];
                const label = item?.label || "";
                const itemId = item?.id || "";
                const isPlayable = item?.isPlayable !== false;
                const maxTextWidth = width - 4; // Account for borders and padding
                const truncatedLabel =
                  label.length > maxTextWidth
                    ? label.slice(0, maxTextWidth - 3) + "..."
                    : label;
                const isNowPlaying = nowPlayingId && itemId === nowPlayingId;

                let textColor = "gray";
                if (!isPlayable) {
                  textColor = "gray"; // black for unplayable
                } else if (isNowPlaying) {
                  textColor = "cyan";
                }

                return (
                  <Text color={textColor} wrap="truncate-end">
                    {truncatedLabel}
                  </Text>
                );
              })()}
            </Box>
          </>
        ) : (
          // When open, show all visible items with truncation
          visibleItems.map((item, index) => {
            const actualIndex = scrollOffset + index;
            const maxTextWidth = width - 4; // Account for borders and padding
            const truncatedLabel =
              item.label.length > maxTextWidth
                ? item.label.slice(0, maxTextWidth - 3) + "..."
                : item.label;

            const isPlayable = item.isPlayable !== false;
            const isNowPlaying = nowPlayingId && item.id === nowPlayingId;
            const isSelected = actualIndex === selectedIndex && isActive;

            let textColor = "gray";
            if (!isPlayable && isSelected) {
              textColor = "red"; // Dark gray for unplayable tracks
            } else if (isNowPlaying) {
              textColor = "cyan";
            } else if (isSelected) {
              textColor = "white";
            }

            return (
              <Box key={item.id} overflow="hidden">
                <Text color={textColor} wrap="truncate-end">
                  {truncatedLabel}
                </Text>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
};

Layer.displayName = "Layer";
