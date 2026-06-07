import { apiRequest } from './apiClient';

/** Espelham os schemas Pydantic em backend/app/schemas/auth.py. */

export type UserPublic = {
  id: string;
  name: string;
  email: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export function register(name: string, email: string, password: string): Promise<UserPublic> {
  return apiRequest<UserPublic>('/auth/register', { method: 'POST', body: { name, email, password } });
}

export function login(email: string, password: string): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/auth/login', { method: 'POST', body: { email, password } });
}
