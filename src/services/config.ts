import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { watch } from "fs";

export type HomeView = "recommendations" | "recent" | "playlists";

export interface AppConfig {
  defaultHome: HomeView;
}

const defaultConfig: AppConfig = {
  defaultHome: "recommendations",
};

class ConfigService {
  private config: AppConfig = { ...defaultConfig };
  private configPath: string;
  private configDir: string;
  private listeners: Set<() => void> = new Set();
  private initialized: boolean = false;
  private initPromise: Promise<void>;

  constructor() {
    this.configDir = join(homedir(), ".config", "apple-music-tui");
    this.configPath = join(this.configDir, "config.json");
    this.initPromise = this.init();
  }

  private async init() {
    try {
      // Ensure config directory exists
      await mkdir(this.configDir, { recursive: true });

      // Try to load existing config
      await this.loadConfig();
      
      this.initialized = true;

      // Watch for config file changes
      try {
        watch(this.configPath, async (eventType) => {
          if (eventType === "change") {
            await this.loadConfig();
            this.notifyListeners();
          }
        });
      } catch (error) {
        // Ignore watch errors
      }
    } catch (error) {
      console.error("Failed to initialize config:", error);
      // Use default config if initialization fails
      this.initialized = true;
    }
  }

  async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  private async loadConfig() {
    try {
      const content = await readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(content);

      // Validate and merge with defaults
      this.config = {
        defaultHome: this.validateHomeView(parsed.defaultHome)
          ? parsed.defaultHome
          : defaultConfig.defaultHome,
      };
    } catch (error) {
      // If file doesn't exist or is invalid, create it with defaults
      await this.saveConfig(defaultConfig);
      this.config = { ...defaultConfig };
    }
  }

  private async saveConfig(config: AppConfig) {
    try {
      await mkdir(this.configDir, { recursive: true });
      await writeFile(
        this.configPath,
        JSON.stringify(config, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  }

  private validateHomeView(view: any): view is HomeView {
    return (
      view === "recommendations" || view === "recent" || view === "playlists"
    );
  }

  getDefaultHome(): HomeView {
    return this.config.defaultHome;
  }

  async setDefaultHome(view: HomeView): Promise<void> {
    this.config.defaultHome = view;
    await this.saveConfig(this.config);
    this.notifyListeners();
  }

  onChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }
}

export const configService = new ConfigService();
