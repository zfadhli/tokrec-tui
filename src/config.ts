import { existsSync, readFileSync } from "node:fs";

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

export function loadConfig(path = "ttlive.json"): AppConfig {
  if (!existsSync(path)) {
    console.error(`Config file not found: ${path}`);
    console.error("Create a ttlive.json file like:");
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
  const raw = readFileSync(path, "utf-8");
  let parsed: Partial<AppConfig>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`Invalid JSON in ${path}`);
    process.exit(1);
  }
  return { ...defaults, ...parsed };
}
