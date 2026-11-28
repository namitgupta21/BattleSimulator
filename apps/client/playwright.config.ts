import { defineConfig, devices } from "@playwright/test";

const serverPort = process.env.E2E_SERVER_PORT || "3000";
const clientPort = process.env.E2E_CLIENT_PORT || "5173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Run multiplayer matches sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${clientPort}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 667 } },
    },
  ],
  webServer: [
    {
      command: "npm start --workspace=@pokemon/server",
      env: { ...process.env, PORT: serverPort },
      url: `http://127.0.0.1:${serverPort}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: `npm run dev --workspace=@pokemon/client -- --port ${clientPort} --host 127.0.0.1`,
      env: { ...process.env, VITE_PROXY_TARGET: `http://127.0.0.1:${serverPort}` },
      url: `http://127.0.0.1:${clientPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
