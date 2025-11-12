import { io, Socket } from "socket.io-client";

const CIDER_BASE_URL = "http://localhost:10767";

export interface NowPlayingData {
  name: string;
  artistName: string;
  albumName: string;
  durationInMillis: number;
  currentPlaybackTime?: number;
  playbackProgress?: number;
  status?: string;
}

export interface PlaybackTimeData {
  currentPlaybackDuration: number;
  currentPlaybackTime: number;
  currentPlaybackTimeRemaining: number;
  isPlaying: boolean;
}

export class SocketService {
  private static socket: Socket | null = null;
  private static listeners: Map<string, Set<(data: any) => void>> = new Map();
  private static currentTrackInfo: NowPlayingData | null = null;
  private static pollInterval: NodeJS.Timeout | null = null;
  private static lastUpdateTime: number = 0;
  private static isFetching: boolean = false;

  static connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(CIDER_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on("connect", () => {
      console.log("Socket.IO connected");
      this.fetchNowPlaying();
    });

    this.socket.on("disconnect", () => {
      console.log("Socket.IO disconnected");
    });

    // Listen for playback time changes
    this.socket.on("API:Playback", (event: any) => {
      if (event.type === "playbackStatus.playbackTimeDidChange") {
        this.updatePlaybackTime(event.data);
      } else if (event.type === "playbackStatus.nowPlayingItemDidChange") {
        this.fetchNowPlaying();
      }
    });

    // Poll for now playing info every 1 second
    this.pollInterval = setInterval(() => {
      this.fetchNowPlaying();
    }, 1000);
  }

  static disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private static async fetchNowPlaying(): Promise<void> {
    if (this.isFetching) return;
    
    this.isFetching = true;
    try {
      const response = await fetch(`${CIDER_BASE_URL}/api/v1/playback/now-playing`);
      if (!response.ok) {
        this.isFetching = false;
        return;
      }
      
      const result = await response.json();
      const info = result.info;
      
      if (info && info.name) {
        // Check if track changed
        const trackChanged = !this.currentTrackInfo || 
                           this.currentTrackInfo.name !== info.name ||
                           this.currentTrackInfo.artistName !== info.artistName;
        
        this.currentTrackInfo = {
          name: info.name,
          artistName: info.artistName,
          albumName: info.albumName,
          durationInMillis: info.durationInMillis,
          currentPlaybackTime: info.currentPlaybackTime,
        };
        
        // Always notify to keep time updated
        this.notifyListeners();
      }
    } catch (error) {
      // Silently fail for local fetch errors
    } finally {
      this.isFetching = false;
    }
  }

  private static updatePlaybackTime(data: PlaybackTimeData): void {
    const now = Date.now();
    
    // Throttle updates to max once per 100ms to avoid flickering
    if (now - this.lastUpdateTime < 100) {
      return;
    }
    
    if (this.currentTrackInfo) {
      this.currentTrackInfo.currentPlaybackTime = data.currentPlaybackTime;
      this.lastUpdateTime = now;
      this.notifyListeners();
    } else {
      // If we don't have track info yet, fetch it
      this.fetchNowPlaying();
    }
  }

  private static notifyListeners(): void {
    const callbacks = this.listeners.get("playback");
    if (callbacks && this.currentTrackInfo) {
      callbacks.forEach((callback) => callback(this.currentTrackInfo));
    }
  }

  static onPlayback(callback: (data: NowPlayingData) => void): () => void {
    if (!this.listeners.has("playback")) {
      this.listeners.set("playback", new Set());
    }
    this.listeners.get("playback")!.add(callback);

    // Send current track info immediately if available
    if (this.currentTrackInfo) {
      callback(this.currentTrackInfo);
    }

    return () => {
      const callbacks = this.listeners.get("playback");
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }
}
