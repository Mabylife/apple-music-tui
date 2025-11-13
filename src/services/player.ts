const CIDER_BASE_URL = "http://localhost:10767";

export class PlayerAPI {
  private static async request(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<any> {
    const url = `${CIDER_BASE_URL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {},
    };

    if (body && method === "POST") {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Player API request failed: ${response.statusText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  // POST endpoints - Playback controls
  static async play(): Promise<void> {
    await this.request("POST", "/api/v1/playback/play");
  }

  static async pause(): Promise<void> {
    await this.request("POST", "/api/v1/playback/pause");
  }

  static async playPause(): Promise<void> {
    await this.request("POST", "/api/v1/playback/playpause");
  }

  static async stop(): Promise<void> {
    await this.request("POST", "/api/v1/playback/stop");
  }

  static async next(): Promise<void> {
    await this.request("POST", "/api/v1/playback/next");
  }

  static async previous(): Promise<void> {
    await this.request("POST", "/api/v1/playback/previous");
  }

  static async setVolume(volume: number): Promise<void> {
    await this.request("POST", "/api/v1/playback/volume", {
      volume: Math.max(0, Math.min(1, volume)),
    });
  }

  static async toggleShuffle(): Promise<void> {
    await this.request("POST", "/api/v1/playback/toggle-shuffle");
  }

  static async toggleRepeat(): Promise<void> {
    await this.request("POST", "/api/v1/playback/toggle-repeat");
  }

  static async toggleAutoPlay(): Promise<void> {
    await this.request("POST", "/api/v1/playback/toggle-autoplay");
  }

  static async seek(position: number): Promise<void> {
    await this.request("POST", "/api/v1/playback/seek", { position });
  }

  // GET endpoints
  static async getNowPlaying(): Promise<any> {
    return await this.request("GET", "/api/v1/playback/now-playing");
  }

  static async getVolume(): Promise<number> {
    const result = await this.request("GET", "/api/v1/playback/volume");
    return result.volume;
  }

  static async getShuffleMode(): Promise<number> {
    const result = await this.request("GET", "/api/v1/playback/shuffle-mode");
    return result.value;
  }

  static async getRepeatMode(): Promise<number> {
    const result = await this.request("GET", "/api/v1/playback/repeat-mode");
    return result.value;
  }

  static async getAutoPlayMode(): Promise<any> {
    const result = await this.request("GET", "/api/v1/playback/autoplay");
    return result.value;
  }
}
