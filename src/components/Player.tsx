import React, { useEffect, useState, useMemo } from "react";
import { Box, Text, useStdout } from "ink";
import { SocketService, NowPlayingData } from "../services/socket";
import { PlayerAPI } from "../services/player";
import Image from "ink-picture";

interface PlayerProps {
  isWide: boolean;
  artSize: number;
  updateTrigger?: number;
}

export const Player: React.FC<PlayerProps> = ({
  isWide,
  artSize,
  updateTrigger,
}) => {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingData | null>(null);
  const [shuffleMode, setShuffleMode] = useState<number>(0);
  const [repeatMode, setRepeatMode] = useState<number>(0);
  const [autoPlayMode, setAutoPlayMode] = useState<boolean>(false);
  const { stdout } = useStdout();

  useEffect(() => {
    SocketService.connect();

    const unsubscribe = SocketService.onPlayback((data) => {
      setNowPlaying(data);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchPlaybackModes = async () => {
      try {
        const [shuffle, repeat] = await Promise.all([
          PlayerAPI.getShuffleMode(),
          PlayerAPI.getRepeatMode(),
        ]);

        // Direct fetch for autoplay to avoid type conversion bug in PlayerAPI
        const autoplayRes = await fetch(
          "http://localhost:10767/api/v1/playback/autoplay"
        );
        const autoplayData = await autoplayRes.json();
        const autoplay = autoplayData.value;

        setShuffleMode(shuffle);
        setRepeatMode(repeat);
        setAutoPlayMode(autoplay);
      } catch (error) {
        console.error("Failed to fetch playback modes:", error);
      }
    };

    fetchPlaybackModes();
  }, [updateTrigger]);

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
        colorTest: "red gray blue white yellow magenta",
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
      colorTest: "red gray blue white yellow magenta",
    };
  }, [nowPlaying]);

  const getPlaybackModeIcons = () => {
    const icons = [];

    // Shuffle: 0 = off, 1 = on
    if (shuffleMode === 1) {
      icons.push("S");
    }

    // Repeat: 0 = off, 1 = one, 2 = all
    if (repeatMode === 1) {
      icons.push("R1");
    } else if (repeatMode === 2) {
      icons.push("RP");
    }

    // Autoplay: false = off, true = on
    if (autoPlayMode === true) {
      icons.push("A");
    }

    return icons.join(" ");
  };

  // Calculate image dimensions based on terminal and artSize
  // Account for borders (2 chars wide, 2 lines high)
  const terminalWidth = stdout.columns || 120;
  const terminalHeight = stdout.rows || 80;
  const playerWidthWide = Math.floor(terminalWidth * 0.35);
  const playerWidthNarrow = terminalWidth;
  const playerHeightNarrow = Math.floor((playerWidthNarrow * 9) / 40);

  // Wide mode: artSize is HEIGHT, image should fill full player width
  // Narrow mode: artSize is WIDTH, image should fill available height
  const imageWidth = isWide ? playerWidthWide - 4 : artSize - 2;
  const imageHeight = isWide ? artSize - 2 : playerHeightNarrow - 2;

  // Get artwork URL from nowPlaying data, no fallback
  const artworkUrl = nowPlaying?.artwork?.url
    ? nowPlaying.artwork.url.replace("{w}", "640").replace("{h}", "640")
    : null;

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
          borderColor="gray"
          flexShrink={0}
          overflow="hidden"
        >
          {artworkUrl && (
            <Image
              src={artworkUrl}
              protocol="halfBlock"
              width={imageWidth}
              height={imageHeight}
            />
          )}
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
          <Text bold color="white">
            {displayInfo.trackName}
          </Text>
          <Text dimColor color="white">
            {displayInfo.artistName}
          </Text>
          <Text dimColor color="white">
            {displayInfo.albumName}
          </Text>
          <Text color="white">{displayInfo.timeDisplay}</Text>
          <Text color="cyan">{getPlaybackModeIcons()}</Text>
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
          borderColor="gray"
          flexShrink={0}
          overflow="hidden"
        >
          {artworkUrl && (
            <Image
              src={artworkUrl}
              protocol="halfBlock"
              width={imageWidth}
              height={imageHeight}
            />
          )}
        </Box>

        {/* Info */}
        <Box
          flexGrow={1}
          borderStyle="single"
          borderColor="gray"
          justifyContent="flex-start"
          alignItems="flex-start"
          flexDirection="column"
          marginLeft={1}
          paddingX={1}
        >
          <Text bold color="white">
            {displayInfo.trackName}
          </Text>
          <Text dimColor color="white">
            {displayInfo.artistName}
          </Text>
          <Text dimColor color="white">
            {displayInfo.albumName}
          </Text>
          <Text color="white">{displayInfo.timeDisplay}</Text>
          <Text color="cyan">{getPlaybackModeIcons()}</Text>
        </Box>
      </Box>
    );
  }
};
