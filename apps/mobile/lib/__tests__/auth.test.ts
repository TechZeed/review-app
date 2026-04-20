import { rest } from "msw";

import type { components } from "../../src/api-types";
import { signInWithEmailPassword } from "../auth";
import { setToken } from "../storage";
import { server } from "../../jest.setup";

type ExchangeTokenResponse = components["schemas"]["ExchangeTokenResponse"];

jest.mock("../storage", () => ({
  getToken: jest.fn(),
  setToken: jest.fn(),
  clearToken: jest.fn(),
}));

jest.mock("../env", () => ({
  apiUrl: "http://localhost",
  webUrl: "",
  dashboardUrl: "",
  firebaseConfig: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    messagingSenderId: "",
    appId: "",
  },
  googleOAuth: {
    webClientId: "",
    iosClientId: "",
    androidClientId: "",
  },
}));

jest.mock("expo-auth-session/providers/google", () => ({
  useAuthRequest: jest.fn(),
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("firebase/app", () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(() => ({})),
}));

jest.mock("firebase/auth", () => ({
  GoogleAuthProvider: {
    credential: jest.fn(),
  },
  getAuth: jest.fn(),
  signInWithCredential: jest.fn(),
}));

describe("signInWithEmailPassword", () => {
  it("returns token and persists it", async () => {
    const payload: ExchangeTokenResponse = {
      accessToken: "jwt-token",
      user: {
        id: "user-1",
        email: "ramesh@reviewapp.demo",
        name: "Ramesh Kumar",
        role: "INDIVIDUAL",
      },
    };

    server.use(
      rest.post("http://localhost/api/v1/auth/login", (_req, res, ctx) => {
        return res(ctx.status(200), ctx.json(payload));
      }),
    );

    const result = await signInWithEmailPassword(
      "ramesh@reviewapp.demo",
      "Demo123",
    );

    expect(result).toEqual({ token: payload.accessToken, user: payload.user });
    expect(setToken).toHaveBeenCalledTimes(1);
    expect(setToken).toHaveBeenCalledWith(payload.accessToken);
  });
});
