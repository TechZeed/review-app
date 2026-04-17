import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Profile } from "@/lib/api";

interface ProfileHeroProps {
  profile: Profile;
}

export function ProfileHero({ profile }: ProfileHeroProps) {
  const initials = profile.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.name}>{profile.name || "Unnamed"}</Text>
        {profile.headline && (
          <Text style={styles.headline}>{profile.headline}</Text>
        )}
        {profile.industry && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{profile.industry}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
  },
  text: {
    flex: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  headline: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 2,
  },
  chip: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: {
    color: "#4338ca",
    fontSize: 12,
    fontWeight: "600",
  },
});

export default ProfileHero;
