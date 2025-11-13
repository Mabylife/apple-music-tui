import fs from "fs";
import path from "path";
import os from "os";

interface PlaybackState {
  shuffle: number; // 0 = off, 1 = on
  repeat: number; // 0 = off, 1 = one, 2 = all
  autoplay: boolean;
}

const CONFIG_DIR = path.join(os.homedir(), ".config", "apple-music-tui");
const STATE_FILE = path.join(CONFIG_DIR, "playback-state.json");

const DEFAULT_STATE: PlaybackState = {
  shuffle: 0,
  repeat: 0,
  autoplay: false,
};

class PlaybackStateService {
  private state: PlaybackState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): PlaybackState {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = fs.readFileSync(STATE_FILE, "utf-8");
        const parsed = JSON.parse(data);
        
        // Validate loaded state
        return {
          shuffle: typeof parsed.shuffle === "number" ? parsed.shuffle : DEFAULT_STATE.shuffle,
          repeat: typeof parsed.repeat === "number" ? parsed.repeat : DEFAULT_STATE.repeat,
          autoplay: typeof parsed.autoplay === "boolean" ? parsed.autoplay : DEFAULT_STATE.autoplay,
        };
      }
    } catch (error) {
      console.error("Failed to load playback state:", error);
    }
    
    return { ...DEFAULT_STATE };
  }

  private saveState(): void {
    try {
      // Ensure config directory exists
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to save playback state:", error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  // Getters
  getShuffleMode(): number {
    return this.state.shuffle;
  }

  getRepeatMode(): number {
    return this.state.repeat;
  }

  getAutoPlayMode(): boolean {
    return this.state.autoplay;
  }

  getAllStates(): PlaybackState {
    return { ...this.state };
  }

  // Toggles
  toggleShuffle(): number {
    this.state.shuffle = this.state.shuffle === 0 ? 1 : 0;
    this.saveState();
    this.notifyListeners();
    return this.state.shuffle;
  }

  toggleRepeat(): number {
    // Cycle: 0 -> 1 -> 2 -> 0
    this.state.repeat = (this.state.repeat + 1) % 3;
    this.saveState();
    this.notifyListeners();
    return this.state.repeat;
  }

  toggleAutoPlay(): boolean {
    this.state.autoplay = !this.state.autoplay;
    this.saveState();
    this.notifyListeners();
    return this.state.autoplay;
  }

  // Change listener
  onChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const playbackStateService = new PlaybackStateService();
