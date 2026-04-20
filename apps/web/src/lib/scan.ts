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
  const scanData = await scanRes.json();

  if (!scanRes.ok) {
    const errorMessage =
      typeof scanData === "object" &&
      scanData !== null &&
      "message" in scanData &&
      typeof scanData.message === "string"
        ? scanData.message
        : typeof scanData === "object" &&
            scanData !== null &&
            "error" in scanData &&
            typeof scanData.error === "string"
          ? scanData.error
          : `Failed to start review (${scanRes.status})`;
    throw new Error(errorMessage);
  }

  return scanData as ScanResponse;
}
