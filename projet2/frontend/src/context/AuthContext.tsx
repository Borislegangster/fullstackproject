import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  loginApi,
  refreshApi,
  getMeApi,
  setPasswordApi,
  complete2FALoginApi,
  type UserOut,
  type LoginPayload,
  type TokenResponse,
} from '../services/api/auth.api';

// ── Types ────────────────────────────────────────────────────
interface AuthState {
  user: UserOut | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  forceReset: boolean;
  /** True when the enforce_2fa policy requires this staff user to enroll. */
  mustSetup2fa: boolean;
}

interface LoginResult {
  forceReset: boolean;
  /** Empty string when twoFactorRequired === true (challenge step). */
  role: string;
  /** Null when twoFactorRequired === true. */
  user: UserOut | null;
  twoFactorRequired?: boolean;
  challengeToken?: string;
  mustSetup2fa?: boolean;
}

interface AuthContextValue extends AuthState {
  login: (payload: LoginPayload) => Promise<LoginResult>;
  complete2FA: (challengeToken: string, code: string) => Promise<LoginResult>;
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
    mustSetup2fa: false,
  });

  const didInit = useRef(false);

  /**
   * Persist a successful TokenResponse: stash tokens + commit state.
   * Used by login, 2FA verify, set-password and the refresh path.
   */
  const applyTokenResponse = useCallback((data: TokenResponse): LoginResult => {
    storeTokens(data.access_token, data.refresh_token);
    const forceReset = data.force_reset ?? false;
    const mustSetup2fa = data.must_setup_2fa ?? data.user.must_setup_2fa ?? false;
    setState({
      user: data.user,
      isAuthenticated: true,
      isLoading: false,
      forceReset,
      mustSetup2fa,
    });
    return { forceReset, role: data.user.role, user: data.user, mustSetup2fa };
  }, []);

  async function tryRefresh(): Promise<boolean> {
    const rt = getStoredRefreshToken();
    if (!rt) return false;
    try {
      applyTokenResponse(await refreshApi(rt));
      return true;
    } catch {
      return false;
    }
  }

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
          mustSetup2fa: user.must_setup_2fa ?? false,
        });
      })
      .catch(async () => {
        const refreshed = await tryRefresh();
        if (!refreshed) {
          clearTokens();
          setState({ user: null, isAuthenticated: false, isLoading: false, forceReset: false, mustSetup2fa: false });
        }
      });
  }, []);

  // ── Login ─────────────────────────────────────────────────
  const login = useCallback(async (payload: LoginPayload): Promise<LoginResult> => {
    const data: any = await loginApi(payload);
    if (data?.two_factor_required) {
      return {
        forceReset: false,
        role: '',
        user: null,
        twoFactorRequired: true,
        challengeToken: data.challenge_token,
      };
    }
    return applyTokenResponse(data as TokenResponse);
  }, [applyTokenResponse]);

  // ── Complete 2FA challenge after login ─────────────────────
  const complete2FA = useCallback(
    async (challengeToken: string, code: string): Promise<LoginResult> => {
      const data = await complete2FALoginApi(challengeToken, code);
      return applyTokenResponse(data);
    },
    [applyTokenResponse]
  );

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearTokens();
    setState({ user: null, isAuthenticated: false, isLoading: false, forceReset: false, mustSetup2fa: false });
  }, []);

  // ── Set new password (onboarding) ─────────────────────────
  const setNewPassword = useCallback(async (password: string, token?: string) => {
    const resp = await setPasswordApi({ new_password: password, token });
    applyTokenResponse(resp);
  }, [applyTokenResponse]);

  // ── Refresh (exposed for interceptor) ─────────────────────
  const refreshSession = useCallback(async (): Promise<boolean> => {
    return tryRefresh();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, complete2FA, logout, refreshSession, setNewPassword }}>
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
