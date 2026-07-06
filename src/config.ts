import { existsSync, readFileSync, writeFileSync } from "node:fs";

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

function stripJsonComments(raw: string): string {
  // Remove single-line comments (// ...)
  // Remove multi-line comments (/* ... */)
  // Avoid matching inside strings
  return raw.replace(/(?:"(?:\\.|[^"\\])*")|(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, (match, comment) =>
    comment ? "" : match,
  );
}

export function loadConfig(): AppConfig {
  let configPath = "";
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
    parsed = JSON.parse(stripJsonComments(raw));
  } catch {
    console.error(`Invalid JSON in ${configPath}`);
    process.exit(1);
  }
  return { ...defaults, ...parsed };
}

export function saveConfig(config: AppConfig, path = "tokrec.json"): void {
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
}
