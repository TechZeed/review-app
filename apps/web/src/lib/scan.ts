import type { components } from "../api-types";

export type ScanResponse = components["schemas"]["ScanResponse"];

export async function scanProfile(
  apiUrl: string,
  slug: string,
  deviceFingerprint: string,
): Promise<ScanResponse> {
  const scanRes = await fetch(`${apiUrl}/api/v1/reviews/scan/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceFingerprint }),
  });
  const scanData = (await scanRes.json()) as ScanResponse;
  if (!scanRes.ok) throw new Error("Failed to start review");
  return scanData;
}
