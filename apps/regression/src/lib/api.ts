import { request, type APIRequestContext } from "@playwright/test";

export async function apiClient(baseURL: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL,
    extraHTTPHeaders: { "content-type": "application/json" },
  });
}
