const CIDER_BASE_URL = "http://localhost:10767";
const STOREFRONT = "tw"; // Default storefront

export interface MusicItem {
  id: string;
  type: "songs" | "albums" | "artists" | "playlists" | "stations";
  label: string;
  icon: string;
  rawData?: any;
}

export class CiderAPI {
  private static async request(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<any> {
    const url = `${CIDER_BASE_URL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  static async getRecommendations(limit: number = 10): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/me/recommendations?limit=${limit}`,
    });

    const items: MusicItem[] = [];
    const recommendations = result?.data?.data || [];

    for (const rec of recommendations) {
      const contents = rec.relationships?.contents?.data || [];
      for (const item of contents.slice(0, 10)) {
        const parsed = this.parseItem(item);
        // Filter out stations - they cause rendering issues
        if (parsed.type !== "stations") {
          items.push(parsed);
        }
      }
      if (items.length >= 10) break;
    }

    return items.slice(0, 10);
  }

  static async search(query: string, limit: number = 10): Promise<MusicItem[]> {
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
        items.push(this.parseItem(item));
        if (items.length >= limit) break;
      }
    }

    // Add albums
    if (results.albums?.data) {
      for (const item of results.albums.data) {
        items.push(this.parseItem(item));
        if (items.length >= limit) break;
      }
    }

    // Add songs
    if (results.songs?.data) {
      for (const item of results.songs.data) {
        items.push(this.parseItem(item));
        if (items.length >= limit) break;
      }
    }

    return items.slice(0, limit);
  }

  static async getAlbumTracks(albumId: string): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/albums/${albumId}`,
    });

    const album = result?.data?.data?.[0];
    const tracks = album?.relationships?.tracks?.data || [];

    return tracks.map((track: any) => this.parseItem(track));
  }

  static async getPlaylistTracks(playlistId: string): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/playlists/${playlistId}`,
    });

    const playlist = result?.data?.data?.[0];
    const tracks = playlist?.relationships?.tracks?.data || [];

    return tracks.map((track: any) => this.parseItem(track));
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

  static async getArtistTopTracks(artistId: string): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/artists/${artistId}/songs?limit=20`,
    });

    const tracks = result?.data?.data || [];
    return tracks.map((track: any) => this.parseItem(track));
  }

  static async getArtistAlbums(artistId: string): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/artists/${artistId}/albums?limit=100`,
    });

    const albums = result?.data?.data || [];
    return albums.map((album: any) => this.parseItem(album));
  }

  static async playItem(id: string, type: string): Promise<void> {
    await this.request("POST", "/api/v1/playback/play-item", {
      id: id.toString(),
      type,
    });
  }

  private static parseItem(item: any): MusicItem {
    const type = item.type;
    let label = "";
    let icon = "";

    switch (type) {
      case "songs":
        label = (item.attributes?.name || "Unknown Track") + " ";
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
    };
  }
}
