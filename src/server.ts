#!/usr/bin/env node

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = await createApp({ config });

const close = async (signal: string): Promise<void> => {
  app.log.info({ signal }, "Shutting down.");
  await app.close();
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void close(signal).finally(() => process.exit(0));
  });
}

try {
  await app.listen({ host: config.server.host, port: config.server.port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await app.close();
}
