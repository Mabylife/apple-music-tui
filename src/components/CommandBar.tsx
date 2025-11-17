import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { styleService } from "../services/style.js";

interface CommandBarProps {
  command: string;
  isFocused: boolean;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  command,
  isFocused,
}) => {
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
    >
      <Text color={isFocused ? style.foregroundColor : style.mutedForegroundColor}>
        {isFocused ? `:${command}` : ":"}
      </Text>
    </Box>
  );
};
