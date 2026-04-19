import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadAppConfig, buildDefines } from "./config/load";

// Mirror the runtime `define` set used by vite.config.ts so tests that
// import `src/lib/config.ts` see APP_CONFIG inlined. Default APP_ENV=local.
const appConfig = loadAppConfig(__dirname);

export default defineConfig({
  plugins: [react()],
  define: buildDefines(appConfig),
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
