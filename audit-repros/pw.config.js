// Audit-only config: runs the repro specs against an already-running server
// on 4180 (the suite owns 4173). Not part of the shipped suite.
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  fullyParallel: false, workers: 1, reporter: 'list', timeout: 120000,
  use: {
    baseURL: 'http://127.0.0.1:4180',
    viewport: { width: 1280, height: 900 },
    launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] },
  },
});
