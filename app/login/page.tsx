'use client';

import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Cpu, Loader2 } from 'lucide-react';
import { login, getOidcProviders } from '@/lib/auth-client';
import type { OidcProviderDto } from '@/lib/auth-client';
import { API_URL } from '@/lib/api';

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, string>) => void;
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<OidcProviderDto[]>([]);
  const telegramRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getOidcProviders().then((list) => setProviders(list.filter((p) => p.isEnabled)));
  }, []);

  // Mount Telegram widget for each telegram provider
  useEffect(() => {
    const telegramProviders = providers.filter((p) => p.providerType === 'telegram' && p.botUsername);
    if (!telegramProviders.length || !telegramRef.current) return;

    const p = telegramProviders[0];
    window.onTelegramAuth = async (data) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/auth/telegram/${p.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Telegram login failed');
        window.location.href = '/';
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', p.botUsername!);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    telegramRef.current.appendChild(script);
  }, [providers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
      setLoading(false);
    }
  }

  const oidcProviders = providers.filter((p) => p.providerType !== 'telegram');
  const hasTelegram = providers.some((p) => p.providerType === 'telegram' && p.botUsername);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="grid h-12 w-12 place-items-center rounded-xl"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
          >
            <Cpu className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold tracking-tight">SignalScope</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              NMS · v1.0.0
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-6 shadow-lg">
          <h1 className="mb-5 text-base font-semibold">Sign in</h1>

          {error && (
            <div className="mb-4 rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-9 w-full rounded-md border border-input bg-elevated px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-input bg-elevated px-3 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-9 mt-8 w-full items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>

          {(oidcProviders.length > 0 || hasTelegram) && (
            <>
              <div className="my-4 flex items-center gap-2 text-[11px] text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                or continue with
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                {oidcProviders.map((p) => (
                  <a
                    key={p.id}
                    href={`${API_URL}/api/auth/oidc/${p.id}/authorize`}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-elevated text-sm font-medium transition-colors hover:bg-sidebar-accent/60"
                  >
                    {p.buttonText}
                  </a>
                ))}
                {hasTelegram && (
                  <div ref={telegramRef} className="flex justify-center" />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
