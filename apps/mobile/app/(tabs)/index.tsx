import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useCallback } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ProfileHero } from "@/components/ProfileHero";
import { Screen } from "@/components/Screen";
import { fetchMe, fetchProfile, type Profile } from "@/lib/api";

// Same ordering as web quality palette.
const QUALITY_COLORS: Record<string, { bg: string; fg: string }> = {
  expertise: { bg: "#dbeafe", fg: "#1d4ed8" },
  care: { bg: "#fce7f3", fg: "#be185d" },
  delivery: { bg: "#dcfce7", fg: "#15803d" },
  initiative: { bg: "#ffedd5", fg: "#c2410c" },
  trust: { bg: "#ede9fe", fg: "#6d28d9" },
};

export default function HomeScreen() {
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  // Spec 19 B4: /profiles/me doesn't expose qualityBreakdown, only
  // /profiles/:slug does. Fetch the public view to derive the top qualities.
  const slug = meQuery.data?.slug;
  const publicQuery = useQuery({
    queryKey: ["profile", slug],
    queryFn: () => fetchProfile(slug!),
    enabled: !!slug,
  });

  const onRefresh = useCallback(() => {
    meQuery.refetch();
    if (slug) publicQuery.refetch();
  }, [meQuery, publicQuery, slug]);

  const refreshing = meQuery.isRefetching || publicQuery.isRefetching;

  const profile: Profile | undefined = meQuery.data;
  const breakdown = publicQuery.data?.qualityBreakdown;

  const topQualities = breakdown
    ? Object.entries(breakdown)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .filter(([, v]) => (v as number) > 0)
        .slice(0, 2)
        .map(([name]) => name)
    : [];

  return (
    <Screen style={styles.screen}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.content}
      >
        {meQuery.isLoading ? (
          <Text style={styles.muted}>Loading...</Text>
        ) : meQuery.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Couldn&apos;t load your profile</Text>
            <Text style={styles.errorText}>
              {meQuery.error instanceof Error
                ? meQuery.error.message
                : "Unknown error"}
            </Text>
          </View>
        ) : profile ? (
          <View style={styles.stack}>
            <ProfileHero profile={profile} />

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total reviews</Text>
              <Text style={styles.statValue} testID="home-review-count">
                {profile.reviewCount ?? 0}
              </Text>
            </View>

            {topQualities.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top qualities</Text>
                <View style={styles.chipRow}>
                  {topQualities.map((q) => {
                    const colour =
                      QUALITY_COLORS[q.toLowerCase()] ?? {
                        bg: "#f1f5f9",
                        fg: "#334155",
                      };
                    return (
                      <View
                        key={q}
                        style={[styles.chip, { backgroundColor: colour.bg }]}
                      >
                        <Text
                          style={[styles.chipText, { color: colour.fg }]}
                        >
                          {q}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {(profile.reviewCount ?? 0) === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No reviews yet</Text>
                <Text style={styles.emptyText}>
                  Get your first review by sharing your QR code.
                </Text>
                <Pressable
                  onPress={() => router.push("/(tabs)/share")}
                  style={({ pressed }) => [
                    styles.cta,
                    pressed && styles.ctaPressed,
                  ]}
                >
                  <Text style={styles.ctaText}>Go to Share tab</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f9fafb",
  },
  content: {
    paddingVertical: 8,
    paddingBottom: 32,
  },
  stack: {
    gap: 16,
  },
  muted: {
    color: "#64748b",
    textAlign: "center",
    marginTop: 32,
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
  statCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  statLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statValue: {
    color: "#0f172a",
    fontSize: 44,
    fontWeight: "800",
    marginTop: 6,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 14,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  emptyBox: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  emptyText: {
    color: "#64748b",
    textAlign: "center",
    fontSize: 14,
  },
  cta: {
    marginTop: 8,
    backgroundColor: "#4f46e5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaPressed: {
    backgroundColor: "#4338ca",
  },
  ctaText: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
