import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ProfileHero } from "@/components/ProfileHero";
import { Screen } from "@/components/Screen";
import { fetchProfile } from "@/lib/api";
import { webUrl } from "@/lib/env";

const QUALITY_COLORS: Record<string, string> = {
  expertise: "#3B82F6",
  care: "#EC4899",
  delivery: "#22C55E",
  initiative: "#F97316",
  trust: "#8B5CF6",
};

export default function PublicProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const query = useQuery({
    queryKey: ["profile", slug],
    queryFn: () => fetchProfile(slug!),
    enabled: !!slug,
  });

  const handleOpenWeb = () => {
    if (!slug) return;
    const base = webUrl.replace(/\/+$/, "");
    Linking.openURL(`${base}/r/${slug}`);
  };

  return (
    <View style={styles.root} testID="public-profile-root">
      <Screen style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          {query.isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color="#4f46e5" />
            </View>
          ) : query.error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Couldn&apos;t load profile</Text>
              <Text style={styles.errorText}>
                {query.error instanceof Error
                  ? query.error.message
                  : "Unknown error"}
              </Text>
            </View>
          ) : query.data ? (
            <>
              <ProfileHero profile={query.data} />

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Reviews</Text>
                <Text style={styles.statValue}>{query.data.reviewCount}</Text>
              </View>

              {query.data.qualityBreakdown && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Quality breakdown</Text>
                  <View style={styles.bars}>
                    {Object.entries(query.data.qualityBreakdown).map(
                      ([name, value]) => {
                        const pct = Math.max(
                          0,
                          Math.min(100, value as number),
                        );
                        const color =
                          QUALITY_COLORS[name.toLowerCase()] ?? "#64748b";
                        return (
                          <View key={name} style={styles.barRow}>
                            <Text style={styles.barLabel}>{name}</Text>
                            <View style={styles.barTrack}>
                              <View
                                style={[
                                  styles.barFill,
                                  {
                                    width: `${pct}%`,
                                    backgroundColor: color,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.barPct}>{pct}%</Text>
                          </View>
                        );
                      },
                    )}
                  </View>
                </View>
              )}

              <Pressable
                onPress={handleOpenWeb}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.cta,
                  pressed && styles.ctaPressed,
                ]}
              >
                <Text style={styles.ctaText}>Leave a review on web</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  screen: {
    backgroundColor: "#f9fafb",
  },
  content: {
    paddingVertical: 8,
    gap: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
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
    fontSize: 38,
    fontWeight: "800",
    marginTop: 4,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  bars: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 8,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  barLabel: {
    width: 80,
    color: "#334155",
    fontSize: 13,
    textTransform: "capitalize",
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
  },
  barPct: {
    width: 40,
    textAlign: "right",
    color: "#64748b",
    fontSize: 12,
  },
  cta: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaPressed: {
    backgroundColor: "#4338ca",
  },
  ctaText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
});
