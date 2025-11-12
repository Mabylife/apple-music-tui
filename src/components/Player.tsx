import React, { useEffect, useState, useMemo } from "react";
import { Box, Text } from "ink";
import { SocketService, NowPlayingData } from "../services/socket";

interface PlayerProps {
  isWide: boolean;
  artSize: number;
  updateTrigger?: number;
}

export const Player: React.FC<PlayerProps> = ({ isWide, artSize }) => {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingData | null>(null);

  useEffect(() => {
    SocketService.connect();

    const unsubscribe = SocketService.onPlayback((data) => {
      setNowPlaying(data);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const formatTime = (millis: number): string => {
    const seconds = Math.floor(millis / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const displayInfo = useMemo(() => {
    if (!nowPlaying) {
      return {
        trackName: "No track playing",
        artistName: "Unknown Artist",
        albumName: "Unknown Album",
        timeDisplay: "0:00 / 0:00",
      };
    }

    const currentTimeMs = nowPlaying.currentPlaybackTime
      ? nowPlaying.currentPlaybackTime * 1000
      : 0;

    const currentTime = currentTimeMs ? formatTime(currentTimeMs) : "0:00";
    const totalTime = nowPlaying.durationInMillis
      ? formatTime(nowPlaying.durationInMillis)
      : "0:00";

    return {
      trackName: nowPlaying.name || "No track playing",
      artistName: nowPlaying.artistName || "Unknown Artist",
      albumName: nowPlaying.albumName || "Unknown Album",
      timeDisplay: `${currentTime} / ${totalTime}`,
    };
  }, [nowPlaying]);

  if (isWide) {
    // Wide mode: Vertical layout (column)
    return (
      <Box
        flexDirection="column"
        height="100%"
        width="100%"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
      >
        {/* Album Art */}
        <Box
          width="100%"
          height={artSize}
          borderStyle="single"
          justifyContent="center"
          alignItems="center"
          flexShrink={0}
          borderColor="gray"
        >
          <Text color="gray">ART</Text>
        </Box>

        {/* Info */}
        <Box
          flexGrow={1}
          borderStyle="single"
          borderColor="gray"
          justifyContent="flex-start"
          alignItems="flex-start"
          flexDirection="column"
          paddingX={1}
        >
          <Text bold color="#ddd">
            {displayInfo.trackName}
          </Text>
          <Text color="gray">{displayInfo.artistName}</Text>
          <Text color="gray">{displayInfo.albumName}</Text>
          <Text color="#ddd">{displayInfo.timeDisplay}</Text>
        </Box>
      </Box>
    );
  } else {
    // Narrow mode: Horizontal layout (row)
    return (
      <Box
        flexDirection="row"
        height="100%"
        width="100%"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
      >
        {/* Album Art */}
        <Box
          width={artSize}
          height="100%"
          borderStyle="single"
          justifyContent="center"
          alignItems="center"
          flexShrink={0}
          borderColor="gray"
        >
          <Text color="gray">ART</Text>
        </Box>

        {/* Info */}
        <Box
          flexGrow={1}
          borderStyle="single"
          borderColor="gray"
          justifyContent="center"
          alignItems="center"
          flexDirection="column"
          marginLeft={1}
          paddingX={1}
        >
          <Text bold color="cyan">
            {displayInfo.trackName}
          </Text>
          <Text color="yellow">{displayInfo.artistName}</Text>
          <Text color="gray">{displayInfo.albumName}</Text>
          <Text color="green">{displayInfo.timeDisplay}</Text>
        </Box>
      </Box>
    );
  }
};
