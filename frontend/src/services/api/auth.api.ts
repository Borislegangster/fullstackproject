import { axiosClient } from './axiosClient';

// ── Types ────────────────────────────────────────────────────
export interface UserOut {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserOut;
}

export interface LoginPayload {
  email: string;
  password: string;
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
