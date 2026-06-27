import { apiRequest } from './apiClient';
import type { ExperienceLevel, UserPublic } from './authService';

export type ProfileUpdate = {
  name?: string;
  weight_kg?: number | null;
  height_cm?: number | null;
  goal?: string | null;
  experience_level?: ExperienceLevel | null;
};

export function getMyProfile(token: string): Promise<UserPublic> {
  return apiRequest<UserPublic>('/users/me', { token });
}

/** PATCH: envia apenas os campos que o usuário alterou — campos ausentes
 * não sobrescrevem os valores existentes (migrado de PUT para PATCH). */
export function updateMyProfile(token: string, payload: ProfileUpdate): Promise<UserPublic> {
  return apiRequest<UserPublic>('/users/me', { method: 'PATCH', token, body: payload });
}
