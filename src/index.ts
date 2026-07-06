import { CLI } from "./cli.ts";
import { loadConfig } from "./config.ts";
import { Manager } from "./manager.ts";

async function main(): Promise<void> {
  const config = loadConfig();
  const manager = new Manager();
  const cli = new CLI(manager, config);

  const onSigint = async () => {
    await cli.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigint);

  try {
    await cli.start();
  } catch (err) {
    console.error("Fatal error:", err);
    await cli.shutdown();
    process.exit(1);
  } finally {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigint);
  }
}

main();
