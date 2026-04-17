import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/context/AuthContext";
import { queryClient } from "@/lib/queryClient";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="r/[slug]" options={{ headerShown: true, title: "Profile" }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
