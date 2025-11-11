import React, { useMemo } from 'react';
import { Box, Text } from 'ink';

interface Item {
  id: string;
  label: string;
}

interface LayerProps {
  items: Item[];
  selectedIndex: number;
  isActive: boolean;
  isClosed: boolean;
  width: number;
  height: number;
}

export const Layer: React.FC<LayerProps> = ({
  items,
  selectedIndex,
  isActive,
  isClosed,
  width,
  height,
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
  
  const visibleItems = items.slice(scrollOffset, scrollOffset + maxVisibleItems);
  
  return (
    <Box
      width={width}
      height={height}
      borderStyle="single"
      borderColor={isActive ? 'white' : 'gray'}
      flexDirection="column"
      paddingX={isClosed ? 0 : 1}
      overflow="hidden"
    >
      <Box flexDirection="column" flexGrow={1}>
        {visibleItems.map((item, index) => {
          const actualIndex = scrollOffset + index;
          return (
            <Box key={item.id} paddingX={isClosed ? 0 : 0}>
              <Text
                color={actualIndex === selectedIndex && isActive ? 'black' : '#ddd'}
                backgroundColor={actualIndex === selectedIndex && isActive ? 'white' : undefined}
                wrap="truncate"
              >
                {isClosed ? (actualIndex === selectedIndex ? '>' : ' ') : item.label}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
