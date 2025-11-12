import React from "react";
import { Box, Text } from "ink";

interface CommandBarProps {
  command: string;
  isFocused: boolean;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  command,
  isFocused,
}) => {
  return (
    <Box
      borderStyle="single"
      borderColor={isFocused ? "white" : "gray"}
      paddingX={1}
      height={3}
      flexShrink={0}
    >
      <Text color={isFocused ? "white" : "gray"}>
        {isFocused ? `:${command}` : ":"}
      </Text>
    </Box>
  );
};
