import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ReviewCard } from "@/components/ReviewCard";
import { Screen } from "@/components/Screen";
import { fetchMe, fetchReviews, type Review } from "@/lib/api";

const PAGE_SIZE = 20;

export default function ReviewsScreen() {
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const profileId = meQuery.data?.id;

  const reviews = useInfiniteQuery({
    queryKey: ["reviews", profileId],
    enabled: !!profileId,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchReviews(profileId!, pageParam as number, PAGE_SIZE),
    getNextPageParam: (last) => {
      const loaded = last.page * last.limit;
      return loaded < last.total ? last.page + 1 : undefined;
    },
  });

  const items: Review[] =
    reviews.data?.pages.flatMap((p) => p.reviews) ?? [];

  if (meQuery.isLoading || (reviews.isLoading && !reviews.data)) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator color="#4f46e5" />
        </View>
      </Screen>
    );
  }

  if (meQuery.error || reviews.error) {
    const err = (meQuery.error ?? reviews.error) as Error | undefined;
    return (
      <Screen style={styles.screen}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn&apos;t load reviews</Text>
          <Text style={styles.errorText}>{err?.message ?? "Unknown error"}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <Text style={styles.heading}>My reviews</Text>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <ReviewCard review={item} />}
        onEndReached={() => {
          if (reviews.hasNextPage && !reviews.isFetchingNextPage) {
            reviews.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
        refreshing={reviews.isRefetching}
        onRefresh={() => reviews.refetch()}
        ListFooterComponent={
          reviews.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color="#4f46e5" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyText}>
              Share your QR code to start collecting reviews.
            </Text>
          </View>
        }
        contentContainerStyle={items.length === 0 ? styles.flexCenter : styles.list}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f9fafb",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
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
  list: {
    paddingBottom: 24,
  },
  flexCenter: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingVertical: 12,
  },
  emptyBox: {
    padding: 24,
    alignItems: "center",
    gap: 6,
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
});
