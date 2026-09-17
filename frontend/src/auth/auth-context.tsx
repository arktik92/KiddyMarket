import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import {
  fetchMe,
  googleSession,
  login as loginApi,
  logoutRequest,
  signup as signupApi,
  type AuthResult,
  type AuthUser,
} from "@/src/api";
import { queryClient } from "@/src/query-client";
import { clearToken, loadToken, saveToken, setUnauthorizedHandler } from "@/src/auth/session";

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider manquant");
  return v;
}

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const processed = useRef<Set<string>>(new Set());

  const finish = async (result: AuthResult) => {
    await saveToken(result.session_token);
    queryClient.clear();
    setUser(result.user);
  };

  const exchange = async (sid: string | null) => {
    if (!sid || processed.current.has(sid)) return;
    processed.current.add(sid);
    const res = await googleSession(sid);
    await finish(res);
  };

  // Mount: process any incoming session_id first, then restore stored session.
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web") {
          const sid = extractSessionId(typeof window !== "undefined" ? window.location.href : null);
          if (sid) {
            await exchange(sid);
            try {
              window.history.replaceState(window.history.state, "", window.location.pathname);
            } catch {}
            setLoading(false);
            return;
          }
        } else {
          const initial = await Linking.getInitialURL();
          const sid = extractSessionId(initial);
          if (sid) await exchange(sid);
        }
        const tok = await loadToken();
        if (tok && !user) {
          const me = await fetchMe();
          setUser(me);
        }
      } catch {
        await clearToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hot deep links (mobile)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      exchange(extractSessionId(url)).catch(() => {});
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 401 -> clear session
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken();
      queryClient.clear();
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async (email: string, password: string) => {
    await finish(await loginApi(email, password));
  };

  const signup = async (email: string, password: string, name: string) => {
    await finish(await signupApi(email, password, name));
  };

  const loginWithGoogle = async () => {
    const redirectUrl = Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let sid: string | null = null;
    if (result.type === "success" && "url" in result) sid = extractSessionId(result.url);
    if (!sid) sid = extractSessionId(await Linking.getInitialURL());
    if (sid) await exchange(sid);
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch {}
    await clearToken();
    queryClient.clear();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, signup, loginWithGoogle, logout }}>
      {children}
    </Ctx.Provider>
  );
}
