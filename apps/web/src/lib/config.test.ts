import { describe, it, expect } from "vitest";
import { config } from "./config";
import localJson from "../../config/appconfig.local.json";
import devJson from "../../config/appconfig.dev.json";
import prodJson from "../../config/appconfig.prod.json";
import { loadAppConfig } from "../../config/load";
import path from "node:path";

const appRoot = path.resolve(__dirname, "../..");

describe("apps/web appconfig", () => {
  it("loader exposes typed config with expected shape (local default)", () => {
    expect(config).toBeDefined();
    expect(typeof config.apiUrl).toBe("string");
    expect(typeof config.publicReviewUrl).toBe("string");
    expect(typeof config.firebase.apiKey).toBe("string");
    expect(typeof config.features.emailLogin).toBe("boolean");
  });

  it("local config points at localhost", () => {
    expect(localJson.apiUrl).toMatch(/localhost/);
  });

  it("dev config has emailLogin=true (regression guard for VITE_FEATURE_EMAIL_LOGIN drop bug)", () => {
    expect(devJson.features.emailLogin).toBe(true);
  });

  it("dev config has non-empty firebase fields", () => {
    expect(devJson.firebase.apiKey).not.toBe("");
    expect(devJson.firebase.authDomain).not.toBe("");
    expect(devJson.firebase.projectId).not.toBe("");
  });

  it("prod config has emailLogin=false (safety)", () => {
    expect(prodJson.features.emailLogin).toBe(false);
  });

  it("dev apiUrl differs from local apiUrl", () => {
    expect(devJson.apiUrl).not.toBe(localJson.apiUrl);
  });

  it("loadAppConfig throws for an unknown APP_ENV", () => {
    expect(() => loadAppConfig(appRoot, "does-not-exist")).toThrow(/appconfig/);
  });

  it("loadAppConfig defaults to local when APP_ENV is unset", () => {
    const prev = process.env.APP_ENV;
    delete process.env.APP_ENV;
    try {
      const cfg = loadAppConfig(appRoot);
      expect(cfg.apiUrl).toBe(localJson.apiUrl);
    } finally {
      if (prev !== undefined) process.env.APP_ENV = prev;
    }
  });
});
