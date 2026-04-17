import { Redirect, Tabs } from "expo-router";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { useAuth } from "@/context/AuthContext";

function TabIcon({ emoji, size }: { emoji: string; size: number }) {
  return <Text style={{ fontSize: size }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#4f46e5" }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ size }) => <TabIcon emoji="🏠" size={size} />,
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: "Reviews",
          tabBarIcon: ({ size }) => <TabIcon emoji="📝" size={size} />,
        }}
      />
      <Tabs.Screen
        name="share"
        options={{
          title: "Share",
          tabBarIcon: ({ size }) => <TabIcon emoji="🔗" size={size} />,
        }}
      />
    </Tabs>
  );
}
