import { MusicItem } from "./api.js";

interface QueueState {
  mode: "in-list" | "single";
  tracks: MusicItem[];
  currentIndex: number;
  playedIndices: number[];
  sourceContext: {
    type: "playlist" | "album" | "top-tracks" | "single";
    id?: string;
    name?: string;
  } | null;
}

export class QueueService {
  private static queue: QueueState = {
    mode: "single",
    tracks: [],
    currentIndex: 0,
    playedIndices: [],
    sourceContext: null,
  };

  static setQueue(
    tracks: MusicItem[],
    startIndex: number,
    context: QueueState["sourceContext"]
  ): void {
    this.queue = {
      mode: "in-list",
      tracks,
      currentIndex: startIndex,
      playedIndices: [startIndex],
      sourceContext: context,
    };
  }

  static setSingleTrack(track: MusicItem): void {
    this.queue = {
      mode: "single",
      tracks: [track],
      currentIndex: 0,
      playedIndices: [0],
      sourceContext: { type: "single" },
    };
  }

  static getNextIndex(shuffle: number, repeat: number): number | null {
    // Safety check: ensure queue exists
    if (!this.queue || !this.queue.tracks) {
      return null;
    }

    const { tracks, currentIndex, playedIndices } = this.queue;

    if (tracks.length === 0) return null;

    // Validate currentIndex
    if (currentIndex < 0 || currentIndex >= tracks.length) {
      return null;
    }

    // Repeat one
    if (repeat === 1) {
      return currentIndex;
    }

    // Shuffle mode
    if (shuffle === 1) {
      const unplayedIndices = tracks
        .map((_, i) => i)
        .filter((i) => !playedIndices.includes(i));

      if (unplayedIndices.length > 0) {
        return unplayedIndices[
          Math.floor(Math.random() * unplayedIndices.length)
        ];
      } else if (repeat === 2) {
        // All played and repeat all: restart
        this.queue.playedIndices = [];
        return Math.floor(Math.random() * tracks.length);
      }
      return null;
    }

    // Sequential mode
    const nextIndex = currentIndex + 1;
    if (nextIndex < tracks.length) {
      return nextIndex;
    } else if (repeat === 2) {
      return 0;
    }
    return null;
  }

  static getPreviousIndex(): number | null {
    // Safety check
    if (!this.queue || !this.queue.tracks) {
      return null;
    }

    const { tracks, currentIndex, playedIndices } = this.queue;

    if (tracks.length === 0) return null;

    // Validate currentIndex
    if (currentIndex < 0 || currentIndex >= tracks.length) {
      return null;
    }

    // Find the last played index before current
    const previousPlayed = playedIndices
      .filter((i) => i < currentIndex && i >= 0 && i < tracks.length)
      .sort((a, b) => b - a)[0];

    if (previousPlayed !== undefined) {
      return previousPlayed;
    }

    // If no previous played, go to previous track in list
    if (currentIndex > 0) {
      return currentIndex - 1;
    }

    // Wrap to end if at beginning
    if (tracks.length > 1) {
      return tracks.length - 1;
    }

    return null;
  }

  static updateCurrentIndex(index: number): void {
    // Safety checks
    if (!this.queue || !this.queue.tracks) {
      return;
    }

    if (index >= 0 && index < this.queue.tracks.length) {
      this.queue.currentIndex = index;
      if (!this.queue.playedIndices.includes(index)) {
        this.queue.playedIndices.push(index);
      }
    }
  }

  static getCurrentTrack(): MusicItem | null {
    // Safety checks
    if (!this.queue || !this.queue.tracks) {
      return null;
    }

    const { tracks, currentIndex } = this.queue;

    if (currentIndex < 0 || currentIndex >= tracks.length) {
      return null;
    }

    return tracks[currentIndex] || null;
  }

  static getQueue(): QueueState {
    return { ...this.queue };
  }

  static clearQueue(): void {
    this.queue = {
      mode: "single",
      tracks: [],
      currentIndex: 0,
      playedIndices: [],
      sourceContext: null,
    };
  }
}
