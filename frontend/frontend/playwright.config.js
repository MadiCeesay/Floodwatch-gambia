import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import process from "node:process";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: { args: ["--use-fake-device-for-media-stream"] },
    channel:
      process.env.E2E_BROWSER_CHANNEL ||
      (existsSync(edge) ? "msedge" : undefined),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/support/api-server.mjs",
      url: "http://127.0.0.1:5011/api/health",
      timeout: 180000,
    },
    {
      command: "npm run dev -- --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      env: {
        API_PROXY_TARGET: "http://127.0.0.1:5011",
        VITE_API_URL: "/api/v1",
      },
      timeout: 60000,
    },
  ],
});
