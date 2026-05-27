import { axiosClient } from './axiosClient';

// ── Types ────────────────────────────────────────────────────
export interface UserOut {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  avatar_url: string | null;
  role: 'ADMIN' | 'CHEF_PROJET' | 'COMPTABLE' | 'RH' | 'CLIENT';
  must_change_password: boolean;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserOut;
  force_reset: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SetPasswordPayload {
  new_password: string;
  invitation_token?: string;
}

// ── API Calls ────────────────────────────────────────────────

/** Authenticate a user and receive access + refresh tokens. */
export async function loginApi(payload: LoginPayload): Promise<TokenResponse> {
  const { data } = await axiosClient.post<TokenResponse>('/auth/login', payload);
  return data;
}

/** Exchange a refresh token for a new token pair. */
export async function refreshApi(refreshToken: string): Promise<TokenResponse> {
  const { data } = await axiosClient.post<TokenResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return data;
}

/** Get the currently authenticated user's profile. */
export async function getMeApi(): Promise<UserOut> {
  const { data } = await axiosClient.get<UserOut>('/auth/me');
  return data;
}

/** Set new password (for onboarding or forced reset). */
export async function setPasswordApi(payload: SetPasswordPayload): Promise<{ detail: string }> {
  const { data } = await axiosClient.post<{ detail: string }>('/auth/set-password', payload);
  return data;
}
