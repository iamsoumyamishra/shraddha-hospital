import { defineConfig, devices } from "@playwright/test";
export default defineConfig({testDir:"./tests/e2e",workers:1,use:{baseURL:process.env.PAPER_E2E_BASE_URL??"http://localhost:3001",trace:"retain-on-failure"},projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}},{name:"mobile",use:{...devices["Pixel 7"]}}],timeout:60000,expect:{timeout:15000}});
