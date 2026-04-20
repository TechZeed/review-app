import { setupServer } from "msw/node";

export const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});

afterAll(() => {
  server.close();
});
