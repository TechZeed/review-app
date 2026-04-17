import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { onAuthError } from "@/lib/api";
import { completeSignIn, type AuthUser } from "@/lib/auth";
import { clearToken, getToken, setToken } from "@/lib/storage";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  signIn: (googleIdToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getToken();
      if (cancelled) return;
      setTokenState(stored);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  // Wire the global 401 handler. Any API call that returns 401 pings this
  // and bounces the user back to the login screen.
  useEffect(() => {
    onAuthError(() => {
      void signOut();
    });
    return () => {
      onAuthError(null);
    };
  }, [signOut]);

  const signIn = useCallback(async (googleIdToken: string) => {
    const { token: appToken, user: appUser } = await completeSignIn(
      googleIdToken,
    );
    setTokenState(appToken);
    setUser(appUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, signIn, signOut }),
    [user, token, isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

// Internal helper retained for tests / seeding from storage.
export const __setTokenFromStorage = setToken;
