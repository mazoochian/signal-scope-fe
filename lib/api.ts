// Server-side: API_URL overrides so containers can reach the backend by internal hostname.
// Client-side: NEXT_PUBLIC_API_URL is baked into the bundle at build time.
export const API_URL =
  (typeof window === 'undefined' ? process.env.API_URL : undefined) ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000';

async function buildHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') {
    try {
      const { cookies } = await import('next/headers');
      const jar = await cookies();
      const token = jar.get('ss-token')?.value;
      if (token) return { Authorization: `Bearer ${token}` };
    } catch {
      // cookies() throws outside request context (e.g. during static generation)
    }
  }
  return {};
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isServer = typeof window === 'undefined';
  const headers = await buildHeaders();
  const fetchOptions: RequestInit = {
    cache: 'no-store',
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  };
  if (!isServer) fetchOptions.credentials = 'include';

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, fetchOptions);
  } catch (cause) {
    if (cause instanceof Error && (cause as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE') {
      throw cause;
    }
    const err = new Error(`BACKEND_UNAVAILABLE: Cannot reach NMS backend at ${API_URL}`);
    err.name = 'BackendUnavailableError';
    err.cause = cause;
    throw err;
  }
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' });
}
