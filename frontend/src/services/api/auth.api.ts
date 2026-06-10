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
  must_setup_2fa?: boolean;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserOut;
  force_reset: boolean;
  must_setup_2fa?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SetPasswordPayload {
  new_password: string;
  /** Invitation token from onboarding email. Sent as `token` to the backend. */
  token?: string;
  /** @deprecated Old name — still accepted by the backend (alias). */
  invitation_token?: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
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

/** Set new password (for onboarding or forced reset).
 * The backend accepts both `token` and `invitation_token`. We send `token`
 * (the canonical field) and keep the legacy name as a fallback.
 */
export async function setPasswordApi(payload: SetPasswordPayload): Promise<TokenResponse> {
  const token = payload.token ?? payload.invitation_token;
  const { data } = await axiosClient.post<TokenResponse>('/auth/set-password', {
    token,
    new_password: payload.new_password,
  });
  return data;
}

/** Request a password reset email. Always succeeds (anti-enumeration). */
export async function forgotPasswordApi(payload: ForgotPasswordPayload): Promise<{ detail: string }> {
  const { data } = await axiosClient.post<{ detail: string }>('/auth/forgot-password', payload);
  return data;
}

/** Consume a password reset token. Returns a fresh token pair. */
export async function resetPasswordApi(payload: ResetPasswordPayload): Promise<TokenResponse> {
  const { data } = await axiosClient.post<TokenResponse>('/auth/reset-password', payload);
  return data;
}

/** Change current user's password (authenticated). */
export async function changePasswordApi(payload: ChangePasswordPayload): Promise<{ detail: string }> {
  const { data } = await axiosClient.post<{ detail: string }>('/auth/change-password', payload);
  return data;
}

/** Update the current user's own profile. */
export async function updateProfileApi(payload: UpdateProfilePayload): Promise<UserOut> {
  const { data } = await axiosClient.patch<UserOut>('/auth/me', payload);
  return data;
}

// ── Two-factor authentication ────────────────────────────────

export interface TwoFactorEnrollResponse {
  otp_uri: string;
  secret: string;
  issuer: string;
}

export interface TwoFactorVerifyResponse {
  detail: string;
  backup_codes: string[];
}

export async function get2FAStatusApi(): Promise<{ enabled: boolean }> {
  const { data } = await axiosClient.get('/auth/2fa/status');
  return data;
}

export async function enroll2FAApi(): Promise<TwoFactorEnrollResponse> {
  const { data } = await axiosClient.post<TwoFactorEnrollResponse>('/auth/2fa/enroll');
  return data;
}

export async function verify2FAApi(code: string): Promise<TwoFactorVerifyResponse> {
  const { data } = await axiosClient.post<TwoFactorVerifyResponse>('/auth/2fa/verify', { code });
  return data;
}

export async function disable2FAApi(password: string): Promise<{ detail: string }> {
  const { data } = await axiosClient.post('/auth/2fa/disable', { password });
  return data;
}

/** Sent as step 2 of login when the server returned `two_factor_required: true`. */
export async function complete2FALoginApi(challengeToken: string, code: string): Promise<TokenResponse> {
  const { data } = await axiosClient.post<TokenResponse>('/auth/2fa/login-verify', {
    challenge_token: challengeToken,
    code,
  });
  return data;
}

// ── Sessions (multi-device) ──────────────────────────────────

export interface SessionInfo {
  id: string;
  device_label: string;
  user_agent: string;
  ip_address: string;
  last_active_at: string | null;
  created_at: string | null;
}

export async function listSessionsApi(): Promise<SessionInfo[]> {
  const { data } = await axiosClient.get<SessionInfo[]>('/auth/sessions');
  return data;
}

export async function revokeSessionApi(sessionId: string): Promise<{ detail: string }> {
  const { data } = await axiosClient.post(`/auth/sessions/${sessionId}/revoke`);
  return data;
}

export async function revokeOtherSessionsApi(): Promise<{ detail: string; count: number }> {
  const { data } = await axiosClient.post('/auth/sessions/revoke-others');
  return data;
}
