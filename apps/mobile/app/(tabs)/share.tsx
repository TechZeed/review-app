import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import React, { useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { QRCard } from "@/components/QRCard";
import { Screen } from "@/components/Screen";
import { ShareQRButton } from "@/components/ShareQRButton";
import { fetchMe } from "@/lib/api";
import { webUrl } from "@/lib/env";

interface QrSvgRef {
  toDataURL: (callback: (data: string) => void) => void;
}

export default function ShareScreen() {
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const qrRef = useRef<QrSvgRef | null>(null);

  const slug = meQuery.data?.slug;
  const publicUrl = slug ? `${webUrl.replace(/\/+$/, "")}/r/${slug}` : "";

  if (meQuery.isLoading) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator color="#4f46e5" />
        </View>
      </Screen>
    );
  }

  if (meQuery.error || !slug) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn&apos;t load your profile</Text>
          <Text style={styles.errorText}>
            {meQuery.error instanceof Error
              ? meQuery.error.message
              : "Profile missing — please sign in again."}
          </Text>
        </View>
      </Screen>
    );
  }

  const handleCopy = async () => {
    await Clipboard.setStringAsync(publicUrl);
    Alert.alert("Copied", publicUrl);
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Share your QR</Text>
        <Text style={styles.subheading}>
          Hand this to someone who&apos;ll leave you a review.
        </Text>

        <QRCard
          value={publicUrl}
          getRef={(c: unknown) => {
            qrRef.current = c as QrSvgRef | null;
          }}
        />

        <View style={styles.actions}>
          <ShareQRButton qrRef={qrRef} publicUrl={publicUrl} />

          <Pressable
            testID="copy-link-button"
            accessibilityLabel="Copy public link"
            accessibilityRole="button"
            onPress={handleCopy}
            style={({ pressed }) => [
              styles.copyButton,
              pressed && styles.copyPressed,
            ]}
          >
            <Text style={styles.copyText}>Copy link</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f9fafb",
  },
  content: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subheading: {
    color: "#64748b",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  actions: {
    width: "100%",
    gap: 10,
    paddingHorizontal: 8,
  },
  copyButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  copyPressed: {
    backgroundColor: "#eef2ff",
  },
  copyText: {
    color: "#4338ca",
    fontWeight: "600",
    fontSize: 15,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  errorTitle: {
    color: "#b91c1c",
    fontWeight: "600",
    marginBottom: 4,
  },
  errorText: {
    color: "#991b1b",
    fontSize: 13,
  },
});
