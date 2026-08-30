// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  // Stated, not inherited. Playwright's 30s default was set for an app that
  // waited on fonts.googleapis.com before it painted (audit M2, fixed by
  // self-hosting) — without that stall a spec that drives a whole house is
  // comfortably inside 30s, but the heaviest ones (a full BUILD HOUSE, a
  // save-and-reload, a section sweep) are not, and a slow CI box needs room
  // besides. 90s is that room; it is not a licence for a spec to sit and
  // wait, and a spec that needs more is a spec to look at, not to raise this
  // for.
  timeout: 90_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
  },
});
