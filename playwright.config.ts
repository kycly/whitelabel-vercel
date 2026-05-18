import { defineConfig, devices } from "@playwright/test";

const PORT = 3005;
const baseURL = `http://127.0.0.1:${PORT}`;
const skipBuild = process.env.PLAYWRIGHT_SKIP_BUILD === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["line"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: skipBuild ? "pnpm start" : "pnpm build && pnpm start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      NEXT_PUBLIC_APP_ENV: "local",
      APP_SESSION_SECRET: "playwright-session-secret",
      KYCLY_API_BASE_URL: "https://api.kycly.test",
    },
  },
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
});