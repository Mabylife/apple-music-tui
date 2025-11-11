import React from 'react';
import { Box, Text } from 'ink';

interface CommandBarProps {
  command: string;
  isFocused: boolean;
}

export const CommandBar: React.FC<CommandBarProps> = ({ command, isFocused }) => {
  return (
    <Box
      borderStyle="single"
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
      height={3}
      flexShrink={0}
    >
      <Text color={isFocused ? 'cyan' : 'gray'}>
        {isFocused ? `:${command}` : ':'}
      </Text>
    </Box>
  );
};
