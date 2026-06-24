'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, Loader2 } from 'lucide-react';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { API_URL } from '@/lib/api';
import type { OidcProviderDto } from '@/lib/auth-client';

type ProviderType = 'google' | 'telegram' | 'keycloak' | 'authentik' | 'authelia' | 'custom';

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'google', label: 'Google' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'keycloak', label: 'Keycloak' },
  { value: 'authentik', label: 'Authentik' },
  { value: 'authelia', label: 'Authelia' },
  { value: 'custom', label: 'Custom OIDC' },
];

const HELP: Record<ProviderType, string> = {
  google: 'Create OAuth 2.0 credentials in Google Cloud Console. Discovery URL is set automatically.',
  telegram: 'Create a bot via @BotFather. Use the bot token and bot username (without @).',
  keycloak: 'Use the realm discovery URL: https://your-keycloak/realms/<realm>/.well-known/openid-configuration',
  authentik: 'Create an OAuth2/OIDC provider in Authentik. Use the discovery URL from the provider details.',
  authelia: 'Register a client in Authelia config. Use https://your-authelia/.well-known/openid-configuration',
  custom: 'Enter either a discovery URL or manually specify each endpoint.',
};

const GOOGLE_DISCOVERY = 'https://accounts.google.com/.well-known/openid-configuration';

interface FormState {
  name: string;
  providerType: ProviderType;
  isEnabled: boolean;
  clientId: string;
  clientSecret: string;
  discoveryUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  scopes: string;
  botToken: string;
  botUsername: string;
  buttonText: string;
}

const defaultForm = (): FormState => ({
  name: '',
  providerType: 'custom',
  isEnabled: true,
  clientId: '',
  clientSecret: '',
  discoveryUrl: '',
  authorizationEndpoint: '',
  tokenEndpoint: '',
  userinfoEndpoint: '',
  scopes: 'openid email profile',
  botToken: '',
  botUsername: '',
  buttonText: 'Sign in',
});

async function apiCall(path: string, method: string, body?: unknown) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(e.message ?? `Request failed: ${res.status}`);
  }
  return res.json().catch(() => null);
}

export default function OidcSettingsPage() {
  const [providers, setProviders] = useState<OidcProviderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);
      const list = await apiCall('/oidc/providers', 'GET');
      setProviders(list ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setForm(defaultForm());
    setEditId(null);
    setError(null);
    setShowForm(true);
  }

  function openEdit(p: OidcProviderDto) {
    setForm({
      name: p.name,
      providerType: p.providerType as ProviderType,
      isEnabled: p.isEnabled,
      clientId: p.clientId ?? '',
      clientSecret: p.clientSecret ?? '',
      discoveryUrl: p.discoveryUrl ?? '',
      authorizationEndpoint: p.authorizationEndpoint ?? '',
      tokenEndpoint: p.tokenEndpoint ?? '',
      userinfoEndpoint: p.userinfoEndpoint ?? '',
      scopes: p.scopes,
      botToken: p.botToken ?? '',
      botUsername: p.botUsername ?? '',
      buttonText: p.buttonText,
    });
    setEditId(p.id);
    setError(null);
    setShowForm(true);
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'providerType') {
        if (v === 'google') next.discoveryUrl = GOOGLE_DISCOVERY;
        else if (f.discoveryUrl === GOOGLE_DISCOVERY) next.discoveryUrl = '';
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        providerType: form.providerType,
        isEnabled: form.isEnabled,
        clientId: form.clientId || null,
        clientSecret: form.clientSecret || null,
        discoveryUrl: form.discoveryUrl || null,
        authorizationEndpoint: form.authorizationEndpoint || null,
        tokenEndpoint: form.tokenEndpoint || null,
        userinfoEndpoint: form.userinfoEndpoint || null,
        scopes: form.scopes || 'openid email profile',
        botToken: form.botToken || null,
        botUsername: form.botUsername || null,
        buttonText: form.buttonText || 'Sign in',
      };
      if (editId !== null) {
        await apiCall(`/oidc/providers/${editId}`, 'PUT', body);
      } else {
        await apiCall('/oidc/providers', 'POST', body);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(id: number) {
    try {
      await apiCall(`/oidc/providers/${id}`, 'DELETE');
      setDeleteId(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const isTelegram = form.providerType === 'telegram';
  const isGoogle = form.providerType === 'google';

  return (
    <>
      <TopBar title="OIDC / SSO" />
      <PageHeader
        title="OIDC / SSO Providers"
        subtitle="Configure identity providers for single sign-on"
        actions={
          <button
            onClick={openAdd}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Add Provider
          </button>
        }
      />

      <main className="flex-1 px-5 py-5">
        {error && (
          <div className="mb-4 rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{error}</div>
        )}

        <Panel title="Identity Providers">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : providers.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No providers configured. Add one to enable SSO.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  {['Name', 'Type', 'Status', 'Button Text', ''].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {providers.map((p) => (
                  <tr key={p.id} className="hover:bg-elevated/40">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">{p.providerType}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.isEnabled ? 'bg-success/15 text-success' : 'bg-muted/40 text-muted-foreground'}`}>
                        {p.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{p.buttonText}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="rounded p-1 hover:bg-elevated">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeleteId(p.id)} className="rounded p-1 hover:bg-elevated">
                          <Trash2 className="h-3.5 w-3.5 text-critical/70" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </main>

      {/* Edit / Add Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{editId !== null ? 'Edit Provider' : 'Add Provider'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            {error && (
              <div className="mb-3 rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{error}</div>
            )}

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <Field label="Name">
                <input value={form.name} onChange={(e) => setField('name', e.target.value)} className="input" />
              </Field>

              <Field label="Provider Type">
                <select value={form.providerType} onChange={(e) => setField('providerType', e.target.value as ProviderType)} className="input">
                  {PROVIDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>

              <div className="rounded-md bg-elevated/50 px-3 py-2 text-[11px] text-muted-foreground">
                {HELP[form.providerType]}
              </div>

              <Field label="Button Text">
                <input value={form.buttonText} onChange={(e) => setField('buttonText', e.target.value)} className="input" />
              </Field>

              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={form.isEnabled} onChange={(e) => setField('isEnabled', e.target.checked)} />
                Enabled
              </label>

              {isTelegram ? (
                <>
                  <Field label="Bot Token (from @BotFather)">
                    <input type="password" value={form.botToken} onChange={(e) => setField('botToken', e.target.value)} className="input" />
                  </Field>
                  <Field label="Bot Username (without @)">
                    <input value={form.botUsername} onChange={(e) => setField('botUsername', e.target.value)} className="input" placeholder="mybotname" />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Client ID">
                    <input value={form.clientId} onChange={(e) => setField('clientId', e.target.value)} className="input" />
                  </Field>
                  <Field label="Client Secret">
                    <input type="password" value={form.clientSecret} onChange={(e) => setField('clientSecret', e.target.value)} className="input" />
                  </Field>
                  <Field label={`Discovery URL${isGoogle ? ' (auto-set)' : ''}`}>
                    <input
                      value={form.discoveryUrl}
                      onChange={(e) => setField('discoveryUrl', e.target.value)}
                      className="input"
                      readOnly={isGoogle}
                      placeholder={isGoogle ? GOOGLE_DISCOVERY : 'https://…/.well-known/openid-configuration'}
                    />
                  </Field>
                  {!isGoogle && (
                    <>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Manual endpoint overrides (optional)</summary>
                        <div className="mt-2 space-y-2 pl-2 border-l border-border">
                          <Field label="Authorization Endpoint">
                            <input value={form.authorizationEndpoint} onChange={(e) => setField('authorizationEndpoint', e.target.value)} className="input" />
                          </Field>
                          <Field label="Token Endpoint">
                            <input value={form.tokenEndpoint} onChange={(e) => setField('tokenEndpoint', e.target.value)} className="input" />
                          </Field>
                          <Field label="Userinfo Endpoint">
                            <input value={form.userinfoEndpoint} onChange={(e) => setField('userinfoEndpoint', e.target.value)} className="input" />
                          </Field>
                        </div>
                      </details>
                      <Field label="Scopes">
                        <input value={form.scopes} onChange={(e) => setField('scopes', e.target.value)} className="input" placeholder="openid email profile" />
                      </Field>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-elevated">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Check className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <h2 className="mb-2 text-sm font-semibold">Delete Provider</h2>
            <p className="mb-5 text-xs text-muted-foreground">This will permanently remove the provider and all linked accounts.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-elevated">Cancel</button>
              <button onClick={() => doDelete(deleteId)} className="h-8 rounded-md bg-critical px-3 text-xs text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
