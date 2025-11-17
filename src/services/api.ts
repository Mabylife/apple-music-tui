const CIDER_BASE_URL = "http://localhost:10767";
const STOREFRONT = "tw"; // Default storefront

export interface MusicItem {
  id: string;
  type:
    | "songs"
    | "albums"
    | "artists"
    | "playlists"
    | "stations"
    | "library-playlists"
    | "library-songs";
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

  static async getRecommendations(
    limit: number = 10,
    layerIndex: number = 0
  ): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/me/recommendations?limit=${limit}`,
    });

    const recommendations = result?.data?.data || [];
    const seenIds = new Set<string>();

    // Collect all items grouped by type
    const itemsByType: { [key: string]: MusicItem[] } = {
      stations: [],
      playlists: [],
      albums: [],
    };

    for (const rec of recommendations) {
      const contents = rec.relationships?.contents?.data || [];
      for (const item of contents) {
        const parsed = this.parseItem(item, layerIndex);
        // Filter out duplicates
        if (!seenIds.has(parsed.id)) {
          seenIds.add(parsed.id);
          const type = parsed.type;
          if (itemsByType[type]) {
            itemsByType[type].push(parsed);
          }
        }
      }
    }

    // Type balance quotas (based on SMARTSORT.md, adjusted for API reality)
    // Note: Recommendations API doesn't return individual songs, only collections
    const typeQuotas: { [key: string]: number } = {
      stations: 0.2, // 20%
      playlists: 0.3, // 30%
      albums: 0.5, // 50%
    };

    // Calculate initial quotas (use floor first)
    const quotas: { [key: string]: number } = {};
    let totalAllocated = 0;

    for (const type in typeQuotas) {
      quotas[type] = Math.floor(limit * typeQuotas[type]);
      totalAllocated += quotas[type];
    }

    // Distribute remaining items to types with largest fractional parts
    const remaining = limit - totalAllocated;
    if (remaining > 0) {
      const fractionalParts = Object.keys(typeQuotas)
        .map((type) => ({
          type,
          fraction:
            limit * typeQuotas[type] - Math.floor(limit * typeQuotas[type]),
        }))
        .sort((a, b) => b.fraction - a.fraction);

      for (let i = 0; i < remaining; i++) {
        quotas[fractionalParts[i].type]++;
      }
    }

    // Adjust quotas if a type has insufficient items
    let totalAdjusted = 0;
    const insufficientTypes: string[] = [];

    for (const type in quotas) {
      const available = itemsByType[type].length;
      if (available < quotas[type]) {
        totalAdjusted += quotas[type] - available;
        quotas[type] = available;
        insufficientTypes.push(type);
      }
    }

    // Redistribute insufficient quota to other types (maintain total count)
    if (totalAdjusted > 0) {
      const availableTypes = Object.keys(quotas)
        .filter(
          (t) =>
            !insufficientTypes.includes(t) && itemsByType[t].length > quotas[t]
        )
        .sort((a, b) => typeQuotas[b] - typeQuotas[a]); // Sort by original quota

      let redistributed = 0;
      for (const type of availableTypes) {
        if (redistributed >= totalAdjusted) break;

        const canAdd = Math.min(
          itemsByType[type].length - quotas[type], // Available items
          totalAdjusted - redistributed // Remaining to redistribute
        );

        quotas[type] += canAdd;
        redistributed += canAdd;
      }
    }

    // Build final result respecting quotas
    const result_items: MusicItem[] = [];
    for (const type in quotas) {
      const quota = quotas[type];
      const items = itemsByType[type].slice(0, quota);
      result_items.push(...items);
    }

    return result_items.slice(0, limit);
  }

  static async search(
    query: string,
    limit: number = 10,
    layerIndex: number = 0
  ): Promise<MusicItem[]> {
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

  static async getAlbumTracks(
    albumId: string,
    layerIndex: number = 2
  ): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/albums/${albumId}`,
    });

    const album = result?.data?.data?.[0];
    const tracks = album?.relationships?.tracks?.data || [];

    return tracks.map((track: any) => this.parseItem(track, layerIndex));
  }

  static async getPlaylistTracks(
    playlistId: string,
    layerIndex: number = 2
  ): Promise<MusicItem[]> {
    // Determine if this is a library playlist (starts with 'p.') or catalog playlist
    const isLibraryPlaylist = playlistId.startsWith("p.");

    const path = isLibraryPlaylist
      ? `/v1/me/library/playlists/${playlistId}/tracks`
      : `/v1/catalog/${STOREFRONT}/playlists/${playlistId}`;

    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path,
    });

    // Handle different response structures
    let tracks;
    if (isLibraryPlaylist) {
      tracks = result?.data?.data || [];
    } else {
      const playlist = result?.data?.data?.[0];
      tracks = playlist?.relationships?.tracks?.data || [];
    }

    return tracks.map((track: any) => this.parseItem(track, layerIndex));
  }

  static async getRecentlyPlayed(
    limit: number = 20,
    layerIndex: number = 0
  ): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/me/recent/played?limit=${limit}`,
    });

    const items = result?.data?.data || [];

    // Use API order directly (already sorted by play time)
    // Optional: deduplicate if the same item was played multiple times
    const seenIds = new Set<string>();
    const deduplicated = items.filter((item: any) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

    return deduplicated.map((item: any) => this.parseItem(item, layerIndex));
  }

  static async getLibraryPlaylists(
    limit: number = 50,
    layerIndex: number = 0
  ): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/me/library/playlists?limit=${limit}`,
    });

    const playlists = result?.data?.data || [];

    // Sort by lastModifiedDate descending (most recent first)
    const sorted = playlists.sort((a: any, b: any) => {
      const dateA = new Date(a.attributes?.lastModifiedDate || 0).getTime();
      const dateB = new Date(b.attributes?.lastModifiedDate || 0).getTime();
      return dateB - dateA;
    });

    return sorted.map((playlist: any) => this.parseItem(playlist, layerIndex));
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

  static async getArtistTopTracks(
    artistId: string,
    layerIndex: number = 2
  ): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/artists/${artistId}/songs?limit=20`,
    });

    const tracks = result?.data?.data || [];
    return tracks.map((track: any) => this.parseItem(track, layerIndex));
  }

  static async getArtistAlbums(
    artistId: string,
    layerIndex: number = 2
  ): Promise<MusicItem[]> {
    const result = await this.request("POST", "/api/v1/amapi/run-v3", {
      path: `/v1/catalog/${STOREFRONT}/artists/${artistId}/albums?limit=100`,
    });

    const albums = result?.data?.data || [];
    return albums.map((album: any) => this.parseItem(album, layerIndex));
  }

  static async playItem(id: string, type: string): Promise<void> {
    // Use 'play-item' as request key to cancel any pending play requests
    await this.request(
      "POST",
      "/api/v1/playback/play-item",
      {
        id: id.toString(),
        type,
      },
      "play-item"
    );
  }

  static async getTrackInfo(trackId: string): Promise<MusicItem | null> {
    try {
      // Determine if this is a library track (starts with 'i.') or catalog track
      const isLibraryTrack = trackId.startsWith("i.");

      const path = isLibraryTrack
        ? `/v1/me/library/songs/${trackId}`
        : `/v1/catalog/${STOREFRONT}/songs/${trackId}`;

      // Use a unified request key 'player-track-info' to cancel ANY previous track info request
      // This prevents race conditions where an old slow request overwrites a newer one
      const result = await this.request(
        "POST",
        "/api/v1/amapi/run-v3",
        {
          path,
        },
        "player-track-info"
      );

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

    if (type === "songs" || type === "library-songs") {
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
      case "library-songs":
        const trackName = item.attributes?.name || "Unknown Track";
        const artistName = item.attributes?.artistName || "";
        // Only show artist name in first or second layer (index 0 or 1)
        const shouldShowArtist = layerIndex !== undefined && layerIndex <= 1;
        label =
          artistName && shouldShowArtist
            ? `${trackName} - ${artistName} `
            : `${trackName} `;
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
      case "library-playlists":
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

  static async createStationFromSongs(
    songIds: string[]
  ): Promise<string | null> {
    try {
      if (songIds.length === 0) {
        return null;
      }

      // Apple Music doesn't support multi-seed custom stations via API
      // Use the first song (most recently played) to create a station
      const mostRecentSongId = songIds[0];

      // Check if this is a library song (starts with 'i.')
      const isLibrarySong = mostRecentSongId.startsWith("i.");

      let catalogSongId = mostRecentSongId;

      // If it's a library song, we need to get its catalog equivalent
      if (isLibrarySong) {
        try {
          // Fetch library song to get its catalog ID
          const libResult = await this.request("POST", "/api/v1/amapi/run-v3", {
            path: `/v1/me/library/songs/${mostRecentSongId}`,
          });

          const libSong = libResult?.data?.data?.[0];
          // Library songs have a playParams.catalogId that points to the catalog version
          catalogSongId =
            libSong?.attributes?.playParams?.catalogId ||
            libSong?.attributes?.playParams?.id;

          if (!catalogSongId) {
            console.error("Failed to get catalog ID from library song");
            return null;
          }
        } catch (error) {
          console.error("Failed to fetch library song for catalog ID:", error);
          return null;
        }
      }

      // Get station for this song using catalog ID
      const result = await this.request("POST", "/api/v1/amapi/run-v3", {
        path: `/v1/catalog/${STOREFRONT}/songs/${catalogSongId}/station`,
      });

      const stationId = result?.data?.data?.[0]?.id;
      return stationId || null;
    } catch (error) {
      console.error("Failed to create station:", error);
      return null;
    }
  }
}
