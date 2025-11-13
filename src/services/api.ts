const CIDER_BASE_URL = "http://localhost:10767";
const STOREFRONT = "tw"; // Default storefront

export interface MusicItem {
  id: string;
  type: "songs" | "albums" | "artists" | "playlists" | "stations";
  label: string;
  icon: string;
  rawData?: any;
  isPlayable?: boolean; // Track if item can be played
}

export class CiderAPI {
  private static activeRequests: Map<string, AbortController> = new Map();
  
  private static async request(
    method: string,
    endpoint: string,
    body?: any,
    requestKey?: string
  ): Promise<any> {
    // Cancel any previous request with the same key
    if (requestKey) {
      const existingController = this.activeRequests.get(requestKey);
      if (existingController) {
        existingController.abort();
      }
    }
    
    const controller = new AbortController();
    if (requestKey) {
      this.activeRequests.set(requestKey, controller);
    }
    
    const url = `${CIDER_BASE_URL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } finally {
      if (requestKey) {
        this.activeRequests.delete(requestKey);
      }
    }
  }

  static async getRecommendations(limit: number = 10, layerIndex: number = 0): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/me/recommendations?limit=${limit}`,
    });

    const items: MusicItem[] = [];
    const recommendations = result?.data?.data || [];
    const seenIds = new Set<string>();

    for (const rec of recommendations) {
      const contents = rec.relationships?.contents?.data || [];
      for (const item of contents.slice(0, 10)) {
        const parsed = this.parseItem(item, layerIndex);
        // Filter out stations - they cause rendering issues
        // Also filter out duplicates
        if (parsed.type !== "stations" && !seenIds.has(parsed.id)) {
          seenIds.add(parsed.id);
          items.push(parsed);
        }
      }
      if (items.length >= 10) break;
    }

    return items.slice(0, 10);
  }

  static async search(query: string, limit: number = 10, layerIndex: number = 0): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/search?term=${encodeURIComponent(
        query
      )}&types=songs,albums,artists&limit=${limit}`,
    });

    const items: MusicItem[] = [];
    const results = result?.data?.results || {};

    // Add artists first (most general)
    if (results.artists?.data) {
      for (const item of results.artists.data) {
        items.push(this.parseItem(item, layerIndex));
        if (items.length >= limit) break;
      }
    }

    // Add albums
    if (results.albums?.data) {
      for (const item of results.albums.data) {
        items.push(this.parseItem(item, layerIndex));
        if (items.length >= limit) break;
      }
    }

    // Add songs
    if (results.songs?.data) {
      for (const item of results.songs.data) {
        items.push(this.parseItem(item, layerIndex));
        if (items.length >= limit) break;
      }
    }

    return items.slice(0, limit);
  }

  static async getAlbumTracks(albumId: string, layerIndex: number = 2): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/albums/${albumId}`,
    });

    const album = result?.data?.data?.[0];
    const tracks = album?.relationships?.tracks?.data || [];

    return tracks.map((track: any) => this.parseItem(track, layerIndex));
  }

  static async getPlaylistTracks(playlistId: string, layerIndex: number = 2): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/playlists/${playlistId}`,
    });

    const playlist = result?.data?.data?.[0];
    const tracks = playlist?.relationships?.tracks?.data || [];

    return tracks.map((track: any) => this.parseItem(track, layerIndex));
  }

  static async getArtistContent(artistId: string): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/artists/${artistId}`,
    });

    const artist = result?.data?.data?.[0];
    const items: MusicItem[] = [];

    // Add a "Top Tracks" item if available
    const topTracksResult = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/artists/${artistId}/songs?limit=1`,
    }).catch(() => null);

    if (topTracksResult?.data?.data && topTracksResult.data.data.length > 0) {
      items.push({
        id: `top-tracks-${artistId}`,
        type: "songs",
        label: "Top Tracks ",
        icon: "󰝚",
        rawData: { artistId, isTopTracks: true },
      });
    }

    // Add "Albums" category
    const albums = artist?.relationships?.albums?.data || [];
    if (albums.length > 0) {
      items.push({
        id: `albums-${artistId}`,
        type: "albums",
        label: "Albums ",
        icon: "󰀥",
        rawData: { artistId, isAlbumsCategory: true },
      });
    }

    return items;
  }

  static async getArtistTopTracks(artistId: string, layerIndex: number = 2): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/artists/${artistId}/songs?limit=20`,
    });

    const tracks = result?.data?.data || [];
    return tracks.map((track: any) => this.parseItem(track, layerIndex));
  }

  static async getArtistAlbums(artistId: string, layerIndex: number = 2): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/artists/${artistId}/albums?limit=100`,
    });

    const albums = result?.data?.data || [];
    return albums.map((album: any) => this.parseItem(album, layerIndex));
  }

  static async playItem(id: string, type: string): Promise<void> {
    // Use 'play-item' as request key to cancel any pending play requests
    await this.request("POST", "/api/v1/playback/play-item", {
      id: id.toString(),
      type,
    }, 'play-item');
  }

  static async getTrackInfo(trackId: string): Promise<MusicItem | null> {
    try {
      // Use a unified request key 'player-track-info' to cancel ANY previous track info request
      // This prevents race conditions where an old slow request overwrites a newer one
      const result = await this.request("POST", "/api/v1/amapi/run-v3", {
        path: `/v1/catalog/${STOREFRONT}/songs/${trackId}`,
      }, 'player-track-info');

      const track = result?.data?.data?.[0];
      if (!track) return null;

      return this.parseItem(track, 0);
    } catch (error) {
      // Silently fail - avoid log spam in TUI
      // This includes AbortError when request is cancelled
      return null;
    }
  }

  private static parseItem(item: any, layerIndex?: number): MusicItem {
    const type = item.type;
    let label = "";
    let icon = "";
    
    // Check if item is playable
    let isPlayable = true;
    
    if (type === "songs") {
      const attributes = item.attributes || {};
      
      // Most reliable check: durationInMillis
      // Prerelease tracks typically have duration of 0, null, or missing
      const duration = attributes.durationInMillis;
      const hasDuration = duration != null && duration > 0;
      
      // Secondary check: playParams must exist for playable songs
      const hasPlayParams = !!(attributes.playParams || item.playParams);
      
      // Track is unplayable if missing duration or playParams
      
      // Song is playable if:
      // - Has valid duration (> 0), AND
      // - Has playParams
      isPlayable = hasDuration && hasPlayParams;
    }

    switch (type) {
      case "songs":
        const trackName = item.attributes?.name || "Unknown Track";
        const artistName = item.attributes?.artistName || "";
        // Only show artist name in first or second layer (index 0 or 1)
        const shouldShowArtist = layerIndex !== undefined && layerIndex <= 1;
        label = artistName && shouldShowArtist ? `${trackName} - ${artistName} ` : `${trackName} `;
        icon = "󰝚";
        break;
      case "albums":
        label = (item.attributes?.name || "Unknown Album") + " ";
        icon = "󰀥";
        break;
      case "artists":
        label = (item.attributes?.name || "Unknown Artist") + " ";
        icon = "󱍞";
        break;
      case "playlists":
        label = (item.attributes?.name || "Unknown Playlist") + " ";
        icon = "󰲸";
        break;
      case "stations":
        label = (item.attributes?.name || "Unknown Station") + " ";
        icon = "󰐹";
        break;
      default:
        label = (item.attributes?.name || item.id) + " ";
        icon = "󰎈";
    }

    return {
      id: item.id,
      type: type as any,
      label,
      icon,
      rawData: item,
      isPlayable,
    };
  }
}
