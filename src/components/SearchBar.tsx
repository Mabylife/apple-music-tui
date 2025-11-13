import React from "react";
import { Box, Text } from "ink";

interface SearchBarProps {
  search: string;
  isFocused: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ search, isFocused }) => {
  return (
    <Box
      borderStyle="round"
      borderColor={isFocused ? "white" : "gray"}
      paddingX={1}
      height={3}
      flexShrink={0}
      flexGrow={1}
    >
      <Text color={isFocused ? "white" : "gray"}>
        {isFocused ? `  ${search}` : "  Use Tab to search"}
      </Text>
    </Box>
  );
};
