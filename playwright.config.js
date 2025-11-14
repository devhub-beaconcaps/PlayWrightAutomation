import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0, // We handle retries manually for clean context
  workers: 1,
  timeout: 180000, // Increased for stability
  
  use: {
    // Use REAL Chrome - more trusted than Chromium
    channel: 'chrome',
    
    headless: true,
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    
    // Critical: Set user agent consistently
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-http2', // ✅ KEY: Disable HTTP/2
        '--disable-quic',  // ✅ KEY: Disable QUIC
        '--disable-images',
        '--window-size=1920,1080',
        '--start-maximized',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    },
    
    actionTimeout: 20000,
    navigationTimeout: 80000,
  },
  
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  // Clean up on failure
  forbidOnly: !!process.env.CI,
});