import { existsSync, readFileSync, writeFileSync } from "node:fs";
import JSONC from "tiny-jsonc";

export interface AppConfig {
  outputDir: string;
  interval: number;
  users: string[];
  cookiesPath?: string;
  duration?: number;
}

const defaults: AppConfig = {
  outputDir: "./recordings",
  interval: 3,
  users: [],
};

const CONFIG_NAMES = ["tokrec.json", "tokrec.jsonc"] as const;

// ponytail: module-scope so saveConfig() can default to the loaded path
export let configPath = "";

export function loadConfig(): AppConfig {
  configPath = "";
  for (const name of CONFIG_NAMES) {
    if (existsSync(name)) {
      configPath = name;
      break;
    }
  }

  if (!configPath) {
    console.error("Config file not found. Create tokrec.json like:");
    console.error(
      JSON.stringify(
        {
          outputDir: "./recordings",
          interval: 3,
          users: ["username"],
          cookiesPath: "./cookies.json",
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const raw = readFileSync(configPath, "utf-8");
  let parsed: Partial<AppConfig>;
  try {
    parsed = JSONC.parse(raw);
  } catch {
    console.error(`Invalid JSON in ${configPath}`);
    process.exit(1);
  }
  return { ...defaults, ...parsed };
}

export function saveConfig(config: AppConfig, path = configPath): void {
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
}
