import { watch } from "fs";
import { readFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

export type BorderStyle =
  | "single"
  | "double"
  | "round"
  | "bold"
  | "singleDouble"
  | "doubleSingle"
  | "classic";

export interface StyleConfig {
  foregroundColor: string;
  mutedForegroundColor: string;
  highlightColor: string;
  errorColor: string;
  borderStyle: BorderStyle;
}

export interface ValidationError {
  key: string;
  value: string;
  reason: string;
}

const defaultConfig: StyleConfig = {
  foregroundColor: "white",
  mutedForegroundColor: "gray",
  highlightColor: "cyan",
  errorColor: "red",
  borderStyle: "round",
};

class StyleService {
  private config: StyleConfig = { ...defaultConfig };
  private configPath: string;
  private listeners: Set<() => void> = new Set();
  private errorListeners: Set<(error: string) => void> = new Set();

  constructor() {
    const configDir = join(homedir(), ".config", "apple-music-tui");
    this.configPath = join(configDir, "style.css");
    this.init();
  }

  private async init() {
    try {
      await this.loadConfig();
    } catch (error) {
      // Use default config if file doesn't exist
    }

    this.watchConfig();
  }

  private async loadConfig() {
    try {
      const content = await readFile(this.configPath, "utf-8");
      this.parseConfig(content);
      this.notifyListeners();
    } catch (error) {
      // File doesn't exist or can't be read, keep current config
    }
  }

  private parseConfig(content: string) {
    const lines = content.split("\n");
    const newConfig: Partial<StyleConfig> = {};
    const errors: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("/*") || trimmed.startsWith("//")) {
        continue;
      }

      const match = trimmed.match(/^([a-z-]+)\s*:\s*(.+?);?\s*$/i);
      if (match) {
        const [, key, value] = match;
        const cleanValue = value.replace(/;$/, "").trim();

        switch (key) {
          case "foreground-color":
            if (this.isValidColor(cleanValue)) {
              newConfig.foregroundColor = cleanValue;
            } else {
              errors.push(`Invalid value: "${cleanValue}" for ${key}`);
            }
            break;
          case "muted-foreground-color":
            if (this.isValidColor(cleanValue)) {
              newConfig.mutedForegroundColor = cleanValue;
            } else {
              errors.push(`Invalid value: "${cleanValue}" for ${key}`);
            }
            break;
          case "highlight-color":
            if (this.isValidColor(cleanValue)) {
              newConfig.highlightColor = cleanValue;
            } else {
              errors.push(`Invalid value: "${cleanValue}" for ${key}`);
            }
            break;
          case "error-color":
            if (this.isValidColor(cleanValue)) {
              newConfig.errorColor = cleanValue;
            } else {
              errors.push(`Invalid value: "${cleanValue}" for ${key}`);
            }
            break;
          case "border-style":
            if (this.isValidBorderStyle(cleanValue)) {
              newConfig.borderStyle = cleanValue as BorderStyle;
            } else {
              errors.push(`Invalid value: "${cleanValue}" for ${key}`);
            }
            break;
        }
      }
    }

    this.config = { ...this.config, ...newConfig };

    if (errors.length > 0) {
      this.notifyErrors(errors.join(", "));
    }
  }

  private isValidColor(value: string): boolean {
    const namedColors = [
      "black",
      "red",
      "green",
      "yellow",
      "blue",
      "magenta",
      "cyan",
      "white",
      "gray",
      "grey",
    ];
    const lowerValue = value.toLowerCase();
    if (namedColors.includes(lowerValue)) {
      return true;
    }
    return /^#[0-9A-Fa-f]{6}$/.test(value);
  }

  private isValidBorderStyle(value: string): value is BorderStyle {
    return [
      "single",
      "double",
      "round",
      "bold",
      "singleDouble",
      "doubleSingle",
      "classic",
    ].includes(value);
  }

  private watchConfig() {
    try {
      watch(this.configPath, async (eventType) => {
        if (eventType === "change") {
          await this.loadConfig();
        }
      });
    } catch (error) {
      // File doesn't exist yet, that's okay
    }
  }

  public getConfig(): StyleConfig {
    return { ...this.config };
  }

  public onChange(callback: () => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public onError(callback: (error: string) => void) {
    this.errorListeners.add(callback);
    return () => {
      this.errorListeners.delete(callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  private notifyErrors(error: string) {
    this.errorListeners.forEach((listener) => listener(error));
  }
}

export const styleService = new StyleService();
