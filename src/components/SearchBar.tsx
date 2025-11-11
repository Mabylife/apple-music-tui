import React from "react";
import { Box, Text } from "ink";

interface SearchBarProps {
  search: string;
  isFocused: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ search, isFocused }) => {
  return (
    <Box
      borderStyle="single"
      borderColor={isFocused ? "#ddd" : "gray"}
      paddingX={1}
      height={3}
      flexShrink={0}
      flexGrow={1}
    >
      <Text color={isFocused ? "#ddd" : "gray"}>
        {isFocused ? `  ${search}` : "  Use Tab to search"}
      </Text>
    </Box>
  );
};
