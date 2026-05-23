import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginApi, refreshApi, getMeApi, type UserOut, type LoginPayload } from '../services/api/auth.api';

// ── Types ────────────────────────────────────────────────────
interface AuthState {
  user: UserOut | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Storage helpers ─────────────────────────────────────────
const TOKEN_KEY = 'globus_token';
const REFRESH_KEY = 'globus_refresh_token';

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

function storeTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ── Provider ────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const didInit = useRef(false);

  // Try to restore the session on mount
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const token = getStoredAccessToken();
    if (!token) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    getMeApi()
      .then((user) => {
        setState({ user, isAuthenticated: true, isLoading: false });
      })
      .catch(async () => {
        // Access token may be expired — try refreshing
        const refreshed = await tryRefresh();
        if (!refreshed) {
          clearTokens();
          setState({ user: null, isAuthenticated: false, isLoading: false });
        }
      });
  }, []);

  async function tryRefresh(): Promise<boolean> {
    const rt = getStoredRefreshToken();
    if (!rt) return false;
    try {
      const data = await refreshApi(rt);
      storeTokens(data.access_token, data.refresh_token);
      setState({ user: data.user, isAuthenticated: true, isLoading: false });
      return true;
    } catch {
      return false;
    }
  }

  // ── Login ─────────────────────────────────────────────────
  const login = useCallback(async (payload: LoginPayload) => {
    const data = await loginApi(payload);
    storeTokens(data.access_token, data.refresh_token);
    setState({ user: data.user, isAuthenticated: true, isLoading: false });
  }, []);

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearTokens();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  // ── Refresh (exposed for interceptor) ─────────────────────
  const refreshSession = useCallback(async (): Promise<boolean> => {
    return tryRefresh();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
