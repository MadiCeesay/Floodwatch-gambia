// Isolated real backend for browser tests. Never connects to the operator's database.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  connectDatabase,
  closeDatabase,
} from "../../../backend/src/config/database.js";
const backendDirectory = new URL("../../../backend/", import.meta.url);
const require = createRequire(
  new URL("package.json", backendDirectory),
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
// Database buffering is disabled: load seed models after connecting, not while
// awaiting creation of the temporary MongoDB server.
const { seedAdmin } = await import("../../../backend/src/seed/seedAdmin.js");
const { FloodReport } = await import("../../../backend/src/models/FloodReport.js");
const { User } = await import("../../../backend/src/models/User.js");
await Promise.all([FloodReport.init(), User.init()]);
await seedAdmin({
  name: "Browser Test Administrator",
  email: "browser@example.test",
  password: "Browser-Test-Only42!",
});
const env = {
  ...process.env,
  NODE_ENV: "test",
  MONGODB_URI: mongo.getUri(),
  JWT_SECRET: randomBytes(48).toString("hex"),
  FRONTEND_URL: "http://127.0.0.1:4173",
  PORT: "5011",
  PUBLIC_REPORT_RATE_LIMIT_MAX: "1000",
  // Exercise the real unconfigured-storage path; never use operator credentials.
  CLOUDINARY_CLOUD_NAME: "",
  CLOUDINARY_API_KEY: "",
  CLOUDINARY_API_SECRET: "",
};
const server = spawn(process.execPath, ["src/server.js"], {
  cwd: fileURLToPath(backendDirectory), env, windowsHide: true, stdio: "inherit",
});
server.once("exit", code => { if (!stopping) process.exit(code || 1); });
let stopping = false;
async function stop() {
  stopping = true;
  if (server.exitCode === null) {
    const exited = new Promise(resolve => server.once("exit", resolve));
    server.kill("SIGTERM");
    await exited;
  }
  await closeDatabase();
  await mongo.stop();
}
process.once("SIGINT", () => stop().finally(() => process.exit()));
process.once("SIGTERM", () => stop().finally(() => process.exit()));
