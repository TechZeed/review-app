import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { isGoogleConfigured, useGoogleSignIn } from "@/lib/auth";

export default function LoginScreen() {
  const { signIn, token, isLoading: authLoading } = useAuth();
  const configured = isGoogleConfigured();
  const [request, response, promptAsync] = useGoogleSignIn();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already authenticated -> bounce into the app.
  useEffect(() => {
    if (!authLoading && token) {
      router.replace("/(tabs)");
    }
  }, [authLoading, token]);

  // React to the Google auth-session result.
  useEffect(() => {
    if (!response) return;
    if (response.type === "success") {
      const idToken = response.authentication?.idToken;
      if (!idToken) {
        setError("Google did not return an ID token. Try again.");
        setPending(false);
        return;
      }
      (async () => {
        try {
          await signIn(idToken);
          router.replace("/(tabs)");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Sign-in failed");
        } finally {
          setPending(false);
        }
      })();
    } else if (response.type === "error") {
      setError(response.error?.message ?? "Google sign-in was cancelled");
      setPending(false);
    } else if (response.type === "cancel" || response.type === "dismiss") {
      setPending(false);
    }
  }, [response, signIn]);

  const disabled = !configured || !request || pending;

  const handlePress = async () => {
    if (!configured) return;
    setError(null);
    setPending(true);
    try {
      await promptAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start sign-in");
      setPending(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Review</Text>
        <Text style={styles.subtitle}>Sign in to see your reviews</Text>

        {!configured && (
          <View style={styles.banner} testID="google-not-configured-banner">
            <Text style={styles.bannerText}>
              Google OAuth not configured — ask Muthu to wire client IDs
            </Text>
          </View>
        )}

        <Pressable
          testID="google-signin-button"
          accessibilityLabel="Sign in with Google"
          accessibilityRole="button"
          onPress={handlePress}
          disabled={disabled}
          style={({ pressed }) => [
            styles.button,
            disabled && styles.buttonDisabled,
            pressed && !disabled && styles.buttonPressed,
          ]}
        >
          {pending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>🔵  Sign in with Google</Text>
          )}
        </Pressable>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 24,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748b",
    marginBottom: 24,
    textAlign: "center",
  },
  banner: {
    backgroundColor: "#fef3c7",
    borderColor: "#fcd34d",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    width: "100%",
  },
  bannerText: {
    color: "#92400e",
    fontSize: 13,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#4f46e5",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  buttonDisabled: {
    backgroundColor: "#a5b4fc",
  },
  buttonPressed: {
    backgroundColor: "#4338ca",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
});
