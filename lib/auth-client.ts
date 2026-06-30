'use client';

import { API_URL } from './api';

export interface UserDto {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
}

export interface OidcProviderDto {
  id: number;
  name: string;
  providerType: string;
  isEnabled: boolean;
  clientId: string | null;
  clientSecret: string | null;
  discoveryUrl: string | null;
  authorizationEndpoint: string | null;
  tokenEndpoint: string | null;
  userinfoEndpoint: string | null;
  scopes: string;
  botToken: string | null;
  botUsername: string | null;
  buttonText: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<UserDto> {
  const data = await post<{ user: UserDto }>('/auth/login', { email, password });
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
  window.location.href = '/login';
}

export async function getMe(): Promise<UserDto> {
  const res = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' });
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

export async function getOidcProviders(): Promise<OidcProviderDto[]> {
  const res = await fetch(`${API_URL}/api/oidc/providers`, { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}
