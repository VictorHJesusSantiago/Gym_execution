import { apiRequest } from './apiClient';
import type { UserPublic } from './authService';

export function getMyProfile(token: string): Promise<UserPublic> {
  return apiRequest<UserPublic>('/users/me', { token });
}

export function updateMyProfile(token: string, name: string): Promise<UserPublic> {
  return apiRequest<UserPublic>('/users/me', { method: 'PUT', token, body: { name } });
}
