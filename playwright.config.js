// playwright.config.ts
import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 2,
  workers: 1,
  timeout: 120000,
  
  use: {
    // Use official Chrome instead of Chromium (more realistic)
    channel: 'chrome', // Install with: npx playwright install chrome
    
    headless: true, // Set to false for now to test
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    
    // Critical: Set user agent BEFORE any navigation
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    
    launchOptions: {
      // Anti-bot detection arguments
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-webgl',
        '--disable-images', // Optional: speeds up loading
        '--window-size=1920,1080',
        '--start-maximized',
      ],
      
      // Remove automation indicators
      ignoreDefaultArgs: [
        '--enable-automation',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-features=Translate',
      ],
      
      // Mock navigator.webdriver
      env: {
        ...process.env,
        // Some sites check process env too
      },
    },
    
    // Slower, more human-like actions
    actionTimeout: 15000,
    navigationTimeout: 60000,
  },
  
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
});