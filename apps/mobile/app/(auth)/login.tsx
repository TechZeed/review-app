import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { isGoogleConfigured, useGoogleSignIn } from "@/lib/auth";

const EMAIL_LOGIN_ENABLED = process.env.EXPO_PUBLIC_FEATURE_EMAIL_LOGIN === "true";

export default function LoginScreen() {
  const { signIn, signInWithPassword, token, isLoading: authLoading } = useAuth();
  const configured = isGoogleConfigured();
  const [request, response, promptAsync] = useGoogleSignIn();
  const [pending, setPending] = useState<"google" | "password" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!authLoading && token) {
      router.replace("/(tabs)");
    }
  }, [authLoading, token]);

  useEffect(() => {
    if (!response) return;
    if (response.type === "success") {
      const idToken = response.authentication?.idToken;
      if (!idToken) {
        setError("Google did not return an ID token. Try again.");
        setPending(null);
        return;
      }
      (async () => {
        try {
          await signIn(idToken);
          router.replace("/(tabs)");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Sign-in failed");
        } finally {
          setPending(null);
        }
      })();
    } else if (response.type === "error") {
      setError(response.error?.message ?? "Google sign-in was cancelled");
      setPending(null);
    } else if (response.type === "cancel" || response.type === "dismiss") {
      setPending(null);
    }
  }, [response, signIn]);

  const googleDisabled = !configured || !request || pending !== null;

  const handleGoogle = async () => {
    if (!configured) return;
    setError(null);
    setPending("google");
    try {
      await promptAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start sign-in");
      setPending(null);
    }
  };

  const handlePasswordSubmit = async () => {
    setError(null);
    setPending("password");
    try {
      await signInWithPassword(email, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      // ApiError from lib/api has a `status` field; 401 means bad creds.
      if (e?.status === 401) {
        setError("Invalid email or password");
      } else {
        setError(e instanceof Error ? e.message : "Sign-in failed");
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Review</Text>
        <Text style={styles.subtitle}>Sign in to see your reviews</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {showEmailForm ? (
          <>
            <TextInput
              testID="email-input"
              placeholder="Email"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
            <TextInput
              testID="password-input"
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoComplete="current-password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
            <Pressable
              testID="password-submit-button"
              accessibilityRole="button"
              onPress={handlePasswordSubmit}
              disabled={pending !== null || !email || !password}
              style={({ pressed }) => [
                styles.button,
                (pending !== null || !email || !password) && styles.buttonDisabled,
                pressed && pending === null && styles.buttonPressed,
              ]}
            >
              {pending === "password" ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setShowEmailForm(false);
                setError(null);
              }}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>← Back to sign-in options</Text>
            </Pressable>
          </>
        ) : (
          <>
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
              onPress={handleGoogle}
              disabled={googleDisabled}
              style={({ pressed }) => [
                styles.button,
                googleDisabled && styles.buttonDisabled,
                pressed && !googleDisabled && styles.buttonPressed,
              ]}
            >
              {pending === "google" ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>🔵  Continue with Google</Text>
              )}
            </Pressable>

            {EMAIL_LOGIN_ENABLED && (
              <Pressable
                testID="email-login-link"
                onPress={() => {
                  setShowEmailForm(true);
                  setError(null);
                }}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>Sign in with email and password</Text>
              </Pressable>
            )}
          </>
        )}
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
  input: {
    width: "100%",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
    marginBottom: 12,
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
  linkButton: {
    marginTop: 16,
    paddingVertical: 6,
  },
  linkText: {
    color: "#4f46e5",
    fontSize: 14,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
});
