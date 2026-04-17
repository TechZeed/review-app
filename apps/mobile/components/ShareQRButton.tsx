// Expo SDK 54 moved the path-based file API under `expo-file-system/legacy`.
// We only need `cacheDirectory` + `writeAsStringAsync` for a tmp PNG.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

// `react-native-qrcode-svg` exposes an SVG ref with a `toDataURL(callback)`
// method that returns a base64 PNG. See its README.
interface QrSvgRef {
  toDataURL: (callback: (data: string) => void) => void;
}

interface ShareQRButtonProps {
  /** Ref to the QRCode SVG (from `QRCode`'s `getRef`). */
  qrRef: React.MutableRefObject<QrSvgRef | null>;
  publicUrl: string;
}

export function ShareQRButton({ qrRef, publicUrl }: ShareQRButtonProps) {
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);

    const svg = qrRef.current;
    try {
      // Fast path: render QR to PNG and share the file so the recipient can
      // save the image directly.
      if (svg && typeof svg.toDataURL === "function") {
        const base64 = await new Promise<string>((resolve) => {
          svg.toDataURL((data) => resolve(data));
        });
        const uri = `${FileSystem.cacheDirectory ?? ""}qr.png`;
        await FileSystem.writeAsStringAsync(uri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, { mimeType: "image/png" });
          return;
        }
      }

      // Fallback: share the URL as text.
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(publicUrl);
      }
    } catch {
      // Swallow — Sharing throws on user cancel on some platforms. Nothing
      // to recover; the user can retry.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      testID="share-qr-button"
      accessibilityLabel="Share my QR code"
      accessibilityRole="button"
      onPress={handlePress}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        busy && styles.disabled,
        pressed && !busy && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Text style={styles.label}>Share my QR</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#4f46e5",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  pressed: {
    backgroundColor: "#4338ca",
  },
  disabled: {
    backgroundColor: "#a5b4fc",
  },
  label: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
});

export default ShareQRButton;
