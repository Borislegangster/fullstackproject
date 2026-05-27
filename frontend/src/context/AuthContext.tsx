import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loginApi, refreshApi, getMeApi, setPasswordApi, type UserOut, type LoginPayload } from '../services/api/auth.api';

// ── Types ────────────────────────────────────────────────────
interface AuthState {
  user: UserOut | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  forceReset: boolean;
}

interface AuthContextValue extends AuthState {
  login: (payload: LoginPayload) => Promise<{ forceReset: boolean }>;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
  setNewPassword: (password: string, token?: string) => Promise<void>;
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

/**
 * Returns the landing page for a given role after login.
 */
export function getLandingPage(role: string): string {
  switch (role) {
    case 'CLIENT':
      return '/espace-client';
    case 'ADMIN':
    case 'CHEF_PROJET':
    case 'COMPTABLE':
    case 'RH':
    default:
      return '/erp';
  }
}

// ── Provider ────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    forceReset: false,
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
        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          forceReset: user.must_change_password ?? false,
        });
      })
      .catch(async () => {
        // Access token may be expired — try refreshing
        const refreshed = await tryRefresh();
        if (!refreshed) {
          clearTokens();
          setState({ user: null, isAuthenticated: false, isLoading: false, forceReset: false });
        }
      });
  }, []);

  async function tryRefresh(): Promise<boolean> {
    const rt = getStoredRefreshToken();
    if (!rt) return false;
    try {
      const data = await refreshApi(rt);
      storeTokens(data.access_token, data.refresh_token);
      setState({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        forceReset: data.force_reset ?? false,
      });
      return true;
    } catch {
      return false;
    }
  }

  // ── Login ─────────────────────────────────────────────────
  const login = useCallback(async (payload: LoginPayload) => {
    const data = await loginApi(payload);
    storeTokens(data.access_token, data.refresh_token);
    const forceReset = data.force_reset ?? false;
    setState({
      user: data.user,
      isAuthenticated: true,
      isLoading: false,
      forceReset,
    });
    return { forceReset };
  }, []);

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearTokens();
    setState({ user: null, isAuthenticated: false, isLoading: false, forceReset: false });
  }, []);

  // ── Set new password (onboarding) ─────────────────────────
  const setNewPassword = useCallback(async (password: string, token?: string) => {
    await setPasswordApi({ new_password: password, invitation_token: token });
    // Re-fetch user to get updated must_change_password=false
    const user = await getMeApi();
    setState(s => ({
      ...s,
      user,
      forceReset: false,
    }));
  }, []);

  // ── Refresh (exposed for interceptor) ─────────────────────
  const refreshSession = useCallback(async (): Promise<boolean> => {
    return tryRefresh();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshSession, setNewPassword }}>
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
