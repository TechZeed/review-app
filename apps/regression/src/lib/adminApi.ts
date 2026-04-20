import type { APIRequestContext } from "@playwright/test";
import type { components } from "../api-types.js";

// Thin wrappers around admin endpoints used by regression (spec 28).
// Caller passes an APIRequestContext already configured with baseURL +
// an admin access token in the authorization header. Keeps specs free
// of repetitive URL/body plumbing.

export type AdminUser = components["schemas"]["AuthUser"];
export type Capability = components["schemas"]["GrantCapability"]["capability"];
export type CapabilityListResponse = { capabilities: components["schemas"]["Capability"][] };

export async function adminListUsers(
  api: APIRequestContext,
  adminToken: string,
): Promise<{ users: AdminUser[] }> {
  const res = await api.get("/api/v1/auth/admin/users", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok()) {
    throw new Error(`adminListUsers failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

export async function adminGrantCapability(
  api: APIRequestContext,
  adminToken: string,
  userId: string,
  capability: Capability,
  reason = "regression",
  expiresAt?: string,
): Promise<CapabilityListResponse> {
  const res = await api.post(`/api/v1/auth/admin/users/${userId}/capabilities`, {
    headers: { authorization: `Bearer ${adminToken}` },
    data: expiresAt ? { capability, reason, expiresAt } : { capability, reason },
  });
  if (!res.ok()) {
    throw new Error(
      `adminGrantCapability(${capability}) failed: ${res.status()} ${await res.text()}`,
    );
  }
  return res.json() as Promise<CapabilityListResponse>;
}

export async function adminRevokeCapability(
  api: APIRequestContext,
  adminToken: string,
  userId: string,
  capability: Capability,
): Promise<void> {
  const res = await api.delete(
    `/api/v1/auth/admin/users/${userId}/capabilities/${capability}`,
    { headers: { authorization: `Bearer ${adminToken}` } },
  );
  // Tolerate 404 — already revoked/not present is a fine terminal state
  // for a cleanup helper.
  if (!res.ok() && res.status() !== 404) {
    throw new Error(
      `adminRevokeCapability(${capability}) failed: ${res.status()} ${await res.text()}`,
    );
  }
}

/** Decode a JWT payload without verifying the signature. */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("not a JWT");
  const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}
