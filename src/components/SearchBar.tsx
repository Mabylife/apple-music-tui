import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { styleService } from "../services/style";

interface SearchBarProps {
  search: string;
  isFocused: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ search, isFocused }) => {
  const [, setStyleUpdate] = useState(0);
  const style = styleService.getConfig();

  useEffect(() => {
    return styleService.onChange(() => {
      setStyleUpdate((prev) => prev + 1);
    });
  }, []);

  return (
    <Box
      borderStyle={style.borderStyle}
      borderColor={isFocused ? style.foregroundColor : style.mutedForegroundColor}
      paddingX={1}
      height={3}
      flexShrink={0}
      flexGrow={1}
    >
      <Text color={isFocused ? style.foregroundColor : style.mutedForegroundColor}>
        {isFocused ? `  ${search}` : "  Use Tab to search"}
      </Text>
    </Box>
  );
};
