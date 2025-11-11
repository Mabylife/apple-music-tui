import React from "react";
import { Box, Text } from "ink";

interface PlayerProps {
  isWide: boolean;
  artSize: number;
}

export const Player: React.FC<PlayerProps> = ({ isWide, artSize }) => {
  if (isWide) {
    // Wide mode: Vertical layout (column)
    // Art on top (visually square), Info below (grows)
    return (
      <Box
        flexDirection="column"
        height="100%"
        width="100%"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
      >
        {/* Album Art - Visually square: width 100%, height = artSize */}
        <Box
          width="100%"
          height={artSize}
          borderStyle="single"
          justifyContent="center"
          alignItems="center"
          flexShrink={0}
          borderColor="gray"
        >
          {/* nerd font music f001 */}
          <Text color={"gray"}>󰝚</Text>
        </Box>

        {/* Info - Grows */}
        <Box
          flexGrow={1}
          borderStyle="single"
          borderColor="gray"
          justifyContent="center"
          alignItems="center"
          flexDirection="column"
        >
          <Text bold>Track Title</Text>
          <Text color="gray">Artist - Album Name</Text>
          <Text color="gray">1:29 / 3:12</Text>
        </Box>
      </Box>
    );
  } else {
    // Narrow mode: Horizontal layout (row)
    // Art on left (visually square), Info on right (grows)
    return (
      <Box
        flexDirection="row"
        height="100%"
        width="100%"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
      >
        {/* Album Art - Visually square: width = artSize, height 100% */}
        <Box
          width={artSize}
          height="100%"
          borderStyle="single"
          justifyContent="center"
          alignItems="center"
          flexShrink={0}
        >
          {/* nerd font music f001 */}
          <Text color={"gray"}>󰝚</Text>
        </Box>

        {/* Info - Grows */}
        <Box
          flexGrow={1}
          borderStyle="single"
          borderColor="gray"
          justifyContent="center"
          alignItems="center"
          flexDirection="column"
          marginLeft={1}
        >
          <Text bold>Now Playing</Text>
          <Text color="gray">Artist - Song Title</Text>
        </Box>
      </Box>
    );
  }
};
