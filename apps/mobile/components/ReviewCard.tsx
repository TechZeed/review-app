import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Review } from "@/lib/api";
import { timeAgo } from "@/lib/time";

// Colour map mirrors apps/ui/src/pages/DashboardPage.tsx QUALITY_COLOR_MAP.
const QUALITY_COLORS: Record<string, { bg: string; fg: string }> = {
  expertise: { bg: "#dbeafe", fg: "#1d4ed8" },
  care: { bg: "#fce7f3", fg: "#be185d" },
  delivery: { bg: "#dcfce7", fg: "#15803d" },
  initiative: { bg: "#ffedd5", fg: "#c2410c" },
  trust: { bg: "#ede9fe", fg: "#6d28d9" },
};

const DEFAULT_COLOR = { bg: "#f1f5f9", fg: "#334155" };

interface ReviewCardProps {
  review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.time}>{timeAgo(review.created_at)}</Text>
        <View style={styles.badges}>
          {review.verified_interaction && (
            <View style={styles.thumbsBadge}>
              <Text style={styles.thumbsText}>👍 Verified</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.chipRow}>
        {review.qualities.map((q) => {
          const colour = QUALITY_COLORS[q.toLowerCase()] ?? DEFAULT_COLOR;
          return (
            <View
              key={q}
              style={[styles.chip, { backgroundColor: colour.bg }]}
            >
              <Text style={[styles.chipText, { color: colour.fg }]}>{q}</Text>
            </View>
          );
        })}
      </View>

      {review.text_content ? (
        <Text style={styles.comment} numberOfLines={3}>
          &ldquo;{review.text_content}&rdquo;
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  time: {
    color: "#64748b",
    fontSize: 12,
  },
  badges: {
    flexDirection: "row",
    gap: 6,
  },
  thumbsBadge: {
    backgroundColor: "#dcfce7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  thumbsText: {
    color: "#15803d",
    fontSize: 11,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  comment: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ReviewCard;
