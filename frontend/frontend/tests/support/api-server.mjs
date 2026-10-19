// Isolated real backend for browser tests. Never connects to the operator's database.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createApp } from "../../../backend/src/app.js";
import { loadEnv } from "../../../backend/src/config/env.js";
import {
  connectDatabase,
  closeDatabase,
} from "../../../backend/src/config/database.js";
import { seedAdmin } from "../../../backend/src/seed/seedAdmin.js";
import { FloodReport } from "../../../backend/src/models/FloodReport.js";
import { User } from "../../../backend/src/models/User.js";
const require = createRequire(
  new URL("../../../backend/package.json", import.meta.url),
);
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const installed =
  process.env.ProgramFiles &&
  join(
    process.env.ProgramFiles,
    "MongoDB",
    "Server",
    "8.2",
    "bin",
    "mongod.exe",
  );
const systemBinary =
  process.env.MONGOMS_SYSTEM_BINARY ||
  (installed && existsSync(installed) ? installed : undefined);
const mongo = await MongoMemoryReplSet.create({
  binary: {
    ...(systemBinary ? { systemBinary } : {}),
    downloadDir: ".cache/mongodb",
  },
  replSet: { count: 1 },
});
await connectDatabase(mongo.getUri());
await Promise.all([FloodReport.init(), User.init()]);
await seedAdmin({
  name: "Browser Test Administrator",
  email: "browser@example.test",
  password: "Browser-Test-Only42!",
});
const env = loadEnv({
  NODE_ENV: "test",
  MONGODB_URI: mongo.getUri(),
  JWT_SECRET: randomBytes(48).toString("hex"),
  FRONTEND_URL: "http://127.0.0.1:4173",
  PUBLIC_REPORT_RATE_LIMIT_MAX: 1000,
});
const server = createApp(env).listen(5011, "127.0.0.1", () =>
  console.info("Isolated browser test API ready"),
);
async function stop() {
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
  await mongo.stop();
}
process.once("SIGINT", () => stop().finally(() => process.exit()));
process.once("SIGTERM", () => stop().finally(() => process.exit()));
