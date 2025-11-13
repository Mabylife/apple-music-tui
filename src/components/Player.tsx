import React, { useEffect, useState, useMemo } from "react";
import { Box, Text, useStdout } from "ink";
import { SocketService, NowPlayingData } from "../services/socket";
import { PlayerAPI } from "../services/player";
import { CiderAPI, MusicItem } from "../services/api";
import Image from "ink-picture";
import { styleService } from "../services/style";

interface PlayerProps {
  isWide: boolean;
  artSize: number;
  updateTrigger?: number;
  nowPlayingId?: string | null;
  isPlayingStation?: boolean;
}

export const Player: React.FC<PlayerProps> = ({
  isWide,
  artSize,
  updateTrigger,
  nowPlayingId,
  isPlayingStation = false,
}) => {
  const [trackInfo, setTrackInfo] = useState<MusicItem | null>(null);
  const [playbackState, setPlaybackState] = useState<NowPlayingData | null>(
    null
  );
  const [shuffleMode, setShuffleMode] = useState<number>(0);
  const [repeatMode, setRepeatMode] = useState<number>(0);
  const [autoPlayMode, setAutoPlayMode] = useState<boolean>(false);
  const [confirmedArtworkUrl, setConfirmedArtworkUrl] = useState<string | null>(
    null
  );
  const [artworkVersion, setArtworkVersion] = useState<number>(0);
  const { stdout } = useStdout();
  const [, setStyleUpdate] = useState(0);
  const style = styleService.getConfig();

  useEffect(() => {
    return styleService.onChange(() => {
      setStyleUpdate((prev) => prev + 1);
    });
  }, []);

  // Fetch track info when nowPlayingId changes (local state is source of truth)
  // Debounced to avoid excessive API calls during rapid track switching
  useEffect(() => {
    if (!nowPlayingId) {
      setTrackInfo(null);
      setConfirmedArtworkUrl(null);
      setArtworkVersion((prev) => prev + 1);
      return;
    }

    let cancelled = false;
    const requestedTrackId = nowPlayingId;
    const requestVersion = artworkVersion + 1;

    // Clear artwork immediately to prevent old image showing
    setConfirmedArtworkUrl(null);
    setArtworkVersion(requestVersion);

    // Debounce: wait 500ms before fetching track info
    // This ensures only the final track in a rapid sequence gets fetched
    const timeoutId = setTimeout(() => {
      CiderAPI.getTrackInfo(requestedTrackId)
        .then((info) => {
          // Double-check: only update if not cancelled AND track ID still matches
          // This prevents race conditions where a slow old request completes after a newer one
          if (!cancelled && info && info.id === requestedTrackId) {
            setTrackInfo(info);

            // Extract and confirm artwork URL with version check
            const artworkUrl = info.rawData?.attributes?.artwork?.url
              ? info.rawData.attributes.artwork.url
                  .replace("{w}", "640")
                  .replace("{h}", "640")
              : null;

            // Only update artwork if this request's version matches current version
            setArtworkVersion((currentVersion) => {
              if (currentVersion === requestVersion && artworkUrl) {
                setConfirmedArtworkUrl(artworkUrl);
              }
              return currentVersion;
            });
          }
        })
        .catch(() => {
          // Silently fail - avoid log spam in TUI
          // This includes AbortError when request is cancelled by API layer
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [nowPlayingId]);

  // Listen to socket for playback time and verification only
  useEffect(() => {
    SocketService.connect();

    const unsubscribe = SocketService.onPlayback((data) => {
      setPlaybackState(data);

      // Optional verification: socket track ID can differ temporarily during track changes
      // This is expected behavior and not an error
    });

    return () => {
      unsubscribe();
    };
  }, [nowPlayingId]);

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
        const autoplayData = (await autoplayRes.json()) as { value: boolean };
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
    // Use local track info as primary source
    if (!trackInfo) {
      return {
        trackName: "No track playing",
        artistName: "Unknown Artist",
        albumName: "Unknown Album",
        timeDisplay: "0:00 / 0:00",
      };
    }

    // Get time from socket playback state
    const currentTimeMs = playbackState?.currentPlaybackTime
      ? playbackState.currentPlaybackTime * 1000
      : 0;

    const currentTime = currentTimeMs ? formatTime(currentTimeMs) : "0:00";

    // Duration from socket if available, otherwise from track info
    const durationMs = playbackState?.durationInMillis || 0;
    const totalTime = durationMs ? formatTime(durationMs) : "0:00";

    // Extract track info from local data
    const trackName = trackInfo.rawData?.attributes?.name || trackInfo.label;
    const artistName =
      trackInfo.rawData?.attributes?.artistName || "Unknown Artist";
    const albumName =
      trackInfo.rawData?.attributes?.albumName || "Unknown Album";

    return {
      trackName,
      artistName,
      albumName,
      timeDisplay: `${currentTime} / ${totalTime}`,
    };
  }, [trackInfo, playbackState]);

  const getPlaybackModeIcons = () => {
    // Don't show playback modes when playing Station
    if (isPlayingStation) {
      return "";
    }
    
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

  if (isWide) {
    // Wide mode: Vertical layout (column)
    return (
      <Box
        flexDirection="column"
        height="100%"
        width="100%"
        borderStyle={style.borderStyle}
        borderColor={style.mutedForegroundColor}
        paddingX={1}
      >
        {/* Album Art */}
        <Box
          width="100%"
          height={artSize}
          borderStyle={style.borderStyle}
          borderColor={style.mutedForegroundColor}
          flexShrink={0}
          overflow="hidden"
        >
          {confirmedArtworkUrl && (
            <Image
              key={`${confirmedArtworkUrl}-${artworkVersion}`}
              src={confirmedArtworkUrl}
              protocol="halfBlock"
              width={imageWidth}
              height={imageHeight}
            />
          )}
        </Box>

        {/* Info */}
        <Box
          flexGrow={1}
          borderStyle={style.borderStyle}
          borderColor={style.mutedForegroundColor}
          justifyContent="flex-start"
          alignItems="flex-start"
          flexDirection="column"
          paddingX={1}
        >
          <Text bold color={style.foregroundColor}>
            {displayInfo.trackName}
          </Text>
          <Text dimColor color={style.foregroundColor}>
            {displayInfo.artistName}
          </Text>
          <Text dimColor color={style.foregroundColor}>
            {displayInfo.albumName}
          </Text>
          <Text color={style.foregroundColor}>{displayInfo.timeDisplay}</Text>
          <Text color={style.highlightColor}>{getPlaybackModeIcons()}</Text>
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
        borderStyle={style.borderStyle}
        borderColor={style.mutedForegroundColor}
        paddingX={1}
      >
        {/* Album Art */}
        <Box
          width={artSize}
          height="100%"
          borderStyle={style.borderStyle}
          borderColor={style.mutedForegroundColor}
          flexShrink={0}
          overflow="hidden"
        >
          {confirmedArtworkUrl && (
            <Image
              key={`${confirmedArtworkUrl}-${artworkVersion}`}
              src={confirmedArtworkUrl}
              protocol="halfBlock"
              width={imageWidth}
              height={imageHeight}
            />
          )}
        </Box>

        {/* Info */}
        <Box
          flexGrow={1}
          borderStyle={style.borderStyle}
          borderColor={style.mutedForegroundColor}
          justifyContent="flex-start"
          alignItems="flex-start"
          flexDirection="column"
          marginLeft={1}
          paddingX={1}
        >
          <Text bold color={style.foregroundColor}>
            {displayInfo.trackName}
          </Text>
          <Text dimColor color={style.foregroundColor}>
            {displayInfo.artistName}
          </Text>
          <Text dimColor color={style.foregroundColor}>
            {displayInfo.albumName}
          </Text>
          <Text color={style.foregroundColor}>{displayInfo.timeDisplay}</Text>
          <Text color={style.highlightColor}>{getPlaybackModeIcons()}</Text>
        </Box>
      </Box>
    );
  }
};
