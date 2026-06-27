import { apiRequest } from './apiClient';

/** Espelham os schemas Pydantic em backend/app/schemas/auth.py. */

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type UserPublic = {
  id: string;
  name: string;
  email: string;
  weight_kg: number | null;
  height_cm: number | null;
  goal: string | null;
  experience_level: ExperienceLevel | null;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type RefreshTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export function register(name: string, email: string, password: string): Promise<UserPublic> {
  return apiRequest<UserPublic>('/auth/register', { method: 'POST', body: { name, email, password } });
}

export function login(email: string, password: string): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/auth/login', { method: 'POST', body: { email, password } });
}

export function refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
  return apiRequest<RefreshTokenResponse>('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  });
}

export function logout(refreshToken: string): Promise<void> {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  });
}
