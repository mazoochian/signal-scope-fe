'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, X, Check, Loader2,
  ShieldPlus, ShieldMinus,
  KeyRound, Users, Lock, ServerCog, Webhook, Mail, Send,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import { API_URL } from '@/lib/api';
import type { OidcProviderDto, UserDto } from '@/lib/auth-client';
import type { StatusKind } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'oidc' | 'users' | 'collectors' | 'integrations' | 'discovery';

type ProviderType = 'google' | 'telegram' | 'slack' | 'oidc';

interface AccessGrant {
  id: number; resourceType: string; resourceId: string | null; permission: string;
}

interface ProviderForm {
  name: string; providerType: ProviderType; isEnabled: boolean;
  clientId: string; clientSecret: string; discoveryUrl: string;
  authorizationEndpoint: string; tokenEndpoint: string; userinfoEndpoint: string;
  scopes: string; botToken: string; botUsername: string; buttonText: string;
}

interface UserForm {
  email: string; firstName: string; lastName: string;
  age: string; role: string; password: string; isActive: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',     label: 'Overview' },
  { key: 'oidc',        label: 'OIDC / SSO' },
  { key: 'users',       label: 'Users' },
  { key: 'collectors',  label: 'Collectors' },
  { key: 'integrations',label: 'Integrations' },
  { key: 'discovery',   label: 'Discovery' },
];

const TAB_SUBTITLES: Record<Tab, string> = {
  overview:     'Authentication, RBAC, collectors, integrations, audit',
  oidc:         'Configure identity providers for single sign-on',
  users:        'Manage user accounts and access control',
  collectors:   'Distributed polling agents and their health',
  integrations: 'Notifications, webhooks, ITSM connections',
  discovery:    'Network scanning, SNMP credentials, auto-discovery rules',
};

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'oidc',     label: 'Generic OIDC' },
  { value: 'google',   label: 'Google' },
  { value: 'slack',    label: 'Slack' },
  { value: 'telegram', label: 'Telegram' },
];

const PROVIDER_HELP: Record<ProviderType, string> = {
  oidc:     'Standard OIDC/OAuth2 provider (Authelia, Authentik, Keycloak, or any custom IdP). Enter a discovery URL or specify endpoints manually.',
  google:   'Create OAuth 2.0 credentials in Google Cloud Console. Discovery URL is set automatically.',
  slack:    'Create a Slack app with "Sign in with Slack" enabled in the OAuth & Permissions section. Discovery URL is set automatically.',
  telegram: 'Create a bot via @BotFather. Use the bot token and bot username (without @).',
};

const GOOGLE_DISCOVERY = 'https://accounts.google.com/.well-known/openid-configuration';
const SLACK_DISCOVERY  = 'https://slack.com/.well-known/openid-configuration';

const ROLES = ['superadmin', 'admin', 'operator', 'troubleshooter', 'viewer'] as const;
const RESOURCE_TYPES = ['site', 'device', 'device_role', 'interface', 'all'] as const;
const PERMISSIONS = ['read', 'write', 'admin'] as const;

const ROLE_COLOR: Record<string, string> = {
  superadmin:   'bg-critical/15 text-critical',
  admin:        'bg-warning/15 text-warning',
  operator:     'bg-primary/15 text-primary',
  troubleshooter: 'bg-success/15 text-success',
  viewer:       'bg-muted/40 text-muted-foreground',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function defaultProviderForm(): ProviderForm {
  return {
    name: '', providerType: 'oidc', isEnabled: true,
    clientId: '', clientSecret: '', discoveryUrl: '',
    authorizationEndpoint: '', tokenEndpoint: '', userinfoEndpoint: '',
    scopes: 'openid email profile', botToken: '', botUsername: '',
    buttonText: 'Sign in',
  };
}

function defaultUserForm(): UserForm {
  return { email: '', firstName: '', lastName: '', age: '', role: 'viewer', password: '', isActive: true };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-3 text-3xl opacity-20">🔧</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">Full management UI coming soon.</p>
    </div>
  );
}

interface OverviewRowProps { l: string; s: string; sub: string; icon: LucideIcon; kind: StatusKind; }

function OverviewRow({ l, s, sub, icon: Icon, kind }: OverviewRowProps) {
  return (
    <div className="mb-2 flex items-center justify-between rounded-md border border-border bg-elevated/40 p-2.5 last:mb-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-panel">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">{l}</div>
          <div className="truncate text-[10px] text-muted-foreground">{sub}</div>
        </div>
      </div>
      <StatusPill kind={kind}>{s}</StatusPill>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('overview');

  // ── OIDC state ─────────────────────────────────────────────────────────────
  const [providers, setProviders] = useState<OidcProviderDto[]>([]);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [oidcLoaded, setOidcLoaded] = useState(false);
  const [oidcError, setOidcError] = useState<string | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderForm>(defaultProviderForm());
  const [oidcEditId, setOidcEditId] = useState<number | null>(null);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [oidcSaving, setOidcSaving] = useState(false);
  const [oidcDeleteId, setOidcDeleteId] = useState<number | null>(null);

  // ── Users state ────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserDto[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(defaultUserForm());
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [grantsUserId, setGrantsUserId] = useState<number | null>(null);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [newGrant, setNewGrant] = useState({ resourceType: 'site', resourceId: '', permission: 'read' });

  // Lazy-load tab data on first switch
  useEffect(() => {
    if (tab === 'oidc' && !oidcLoaded) loadProviders();
    if (tab === 'users' && !usersLoaded) loadUsers();
  }, [tab]);

  // ── OIDC handlers ──────────────────────────────────────────────────────────

  async function loadProviders() {
    setOidcLoading(true);
    setOidcError(null);
    try {
      const list = await apiCall('/oidc/providers', 'GET');
      setProviders(list ?? []);
      setOidcLoaded(true);
    } catch (e: any) {
      setOidcError(e.message);
    } finally {
      setOidcLoading(false);
    }
  }

  function openAddProvider() {
    setProviderForm(defaultProviderForm());
    setOidcEditId(null);
    setOidcError(null);
    setShowProviderForm(true);
  }

  function openEditProvider(p: OidcProviderDto) {
    setProviderForm({
      name: p.name, providerType: p.providerType as ProviderType,
      isEnabled: p.isEnabled, clientId: p.clientId ?? '',
      clientSecret: p.clientSecret ?? '', discoveryUrl: p.discoveryUrl ?? '',
      authorizationEndpoint: p.authorizationEndpoint ?? '',
      tokenEndpoint: p.tokenEndpoint ?? '', userinfoEndpoint: p.userinfoEndpoint ?? '',
      scopes: p.scopes, botToken: p.botToken ?? '',
      botUsername: (p as any).botUsername ?? '', buttonText: p.buttonText,
    });
    setOidcEditId(p.id);
    setOidcError(null);
    setShowProviderForm(true);
  }

  function setProviderField<K extends keyof ProviderForm>(k: K, v: ProviderForm[K]) {
    setProviderForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'providerType') {
        if (v === 'google') next.discoveryUrl = GOOGLE_DISCOVERY;
        else if (v === 'slack') next.discoveryUrl = SLACK_DISCOVERY;
        else if (f.discoveryUrl === GOOGLE_DISCOVERY || f.discoveryUrl === SLACK_DISCOVERY) next.discoveryUrl = '';
      }
      return next;
    });
  }

  async function saveProvider() {
    setOidcSaving(true);
    setOidcError(null);
    try {
      const body = {
        name: providerForm.name, providerType: providerForm.providerType,
        isEnabled: providerForm.isEnabled, clientId: providerForm.clientId || null,
        clientSecret: providerForm.clientSecret || null,
        discoveryUrl: providerForm.discoveryUrl || null,
        authorizationEndpoint: providerForm.authorizationEndpoint || null,
        tokenEndpoint: providerForm.tokenEndpoint || null,
        userinfoEndpoint: providerForm.userinfoEndpoint || null,
        scopes: providerForm.scopes || 'openid email profile',
        botToken: providerForm.botToken || null,
        botUsername: providerForm.botUsername || null,
        buttonText: providerForm.buttonText || 'Sign in',
      };
      if (oidcEditId !== null) await apiCall(`/oidc/providers/${oidcEditId}`, 'PUT', body);
      else await apiCall('/oidc/providers', 'POST', body);
      setShowProviderForm(false);
      loadProviders();
    } catch (e: any) {
      setOidcError(e.message);
    } finally {
      setOidcSaving(false);
    }
  }

  async function deleteProvider(id: number) {
    try {
      await apiCall(`/oidc/providers/${id}`, 'DELETE');
      setOidcDeleteId(null);
      loadProviders();
    } catch (e: any) {
      setOidcError(e.message);
    }
  }

  // ── Users handlers ─────────────────────────────────────────────────────────

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const list = await apiCall('/users', 'GET');
      setUsers(list ?? []);
      setUsersLoaded(true);
    } catch (e: any) {
      setUsersError(e.message);
    } finally {
      setUsersLoading(false);
    }
  }

  function openAddUser() {
    setUserForm(defaultUserForm());
    setEditUser(null);
    setUsersError(null);
    setShowUserForm(true);
  }

  function openEditUser(u: UserDto) {
    setUserForm({
      email: u.email, firstName: u.firstName ?? '', lastName: u.lastName ?? '',
      age: u.age?.toString() ?? '', role: u.role, password: '', isActive: u.isActive,
    });
    setEditUser(u);
    setUsersError(null);
    setShowUserForm(true);
  }

  async function saveUser() {
    setUserSaving(true);
    setUsersError(null);
    try {
      const body: any = {
        firstName: userForm.firstName || null,
        lastName: userForm.lastName || null,
        age: userForm.age ? parseInt(userForm.age, 10) : null,
        role: userForm.role, isActive: userForm.isActive,
      };
      if (userForm.password) body.password = userForm.password;
      if (!editUser) { body.email = userForm.email; await apiCall('/users', 'POST', body); }
      else await apiCall(`/users/${editUser.id}`, 'PUT', body);
      setShowUserForm(false);
      loadUsers();
    } catch (e: any) {
      setUsersError(e.message);
    } finally {
      setUserSaving(false);
    }
  }

  async function deleteUser(id: number) {
    try {
      await apiCall(`/users/${id}`, 'DELETE');
      setDeleteUserId(null);
      loadUsers();
    } catch (e: any) {
      setUsersError(e.message);
    }
  }

  async function openGrants(userId: number) {
    const list = await apiCall(`/users/${userId}/grants`, 'GET');
    setGrants(list ?? []);
    setGrantsUserId(userId);
  }

  async function addGrant() {
    if (!grantsUserId) return;
    await apiCall(`/users/${grantsUserId}/grants`, 'POST', {
      resourceType: newGrant.resourceType,
      resourceId: newGrant.resourceId || null,
      permission: newGrant.permission,
    });
    openGrants(grantsUserId);
  }

  async function removeGrant(grantId: number) {
    if (!grantsUserId) return;
    await apiCall(`/users/${grantsUserId}/grants/${grantId}`, 'DELETE');
    openGrants(grantsUserId);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const isTelegram      = providerForm.providerType === 'telegram';
  const isAutoDiscovery = providerForm.providerType === 'google' || providerForm.providerType === 'slack';

  const tabActions: Partial<Record<Tab, React.ReactNode>> = {
    oidc: (
      <button onClick={openAddProvider}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground hover:opacity-90">
        <Plus className="h-3.5 w-3.5" /> Add Provider
      </button>
    ),
    users: (
      <button onClick={openAddUser}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground hover:opacity-90">
        <Plus className="h-3.5 w-3.5" /> Add User
      </button>
    ),
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <TopBar title="Settings" />
      <PageHeader
        title="Settings"
        subtitle={TAB_SUBTITLES[tab]}
        actions={tabActions[tab]}
      />

      {/* Tab bar */}
      <div className="border-b border-border bg-background">
        <div className="flex gap-0 px-5">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative px-4 py-2.5 text-[12px] font-medium transition-colors ${
                tab === key
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/80'
              }`}
            >
              {label}
              {tab === key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 px-5 py-5">

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Authentication" subtitle="SSO · OAuth2 · OIDC · LDAP · MFA">
              {(
                [
                  { l: 'Azure AD (OIDC)', s: 'connected', icon: KeyRound, sub: 'tenant: signalscope.io · 412 users', kind: 'up' },
                  { l: 'LDAP / Active Directory', s: 'connected', icon: Users, sub: 'corp.local · sync 5m', kind: 'up' },
                  { l: 'MFA · TOTP + WebAuthn', s: 'enforced', icon: Lock, sub: 'all users · 38 enrolled this week', kind: 'up' },
                ] as { l: string; s: string; icon: LucideIcon; sub: string; kind: StatusKind }[]
              ).map((x) => <OverviewRow key={x.l} {...x} />)}
            </Panel>

            <Panel title="RBAC Roles" subtitle="Least-privilege · approval workflows on write actions">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    {['Role', 'Members', 'Read', 'Write', 'Approve'].map((h) => (
                      <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ['NOC L1', '42', 'All', '—', '—'],
                    ['NOC L2', '18', 'All', 'Limited', '—'],
                    ['Network Eng', '12', 'All', 'All', 'Self'],
                    ['Change Mgr', '4', 'All', '—', 'All'],
                    ['Auditor', '6', 'All read-only', '—', '—'],
                  ].map((r) => (
                    <tr key={r[0]} className="hover:bg-elevated/40">
                      {r.map((c, i) => <td key={i} className="px-2 py-2 font-mono">{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            <Panel title="Distributed Collectors" subtitle="4 online · 1,314 devices balanced">
              {(
                [
                  { l: 'collector-us-east-01', s: 'online',   icon: ServerCog, sub: '412 devices · poll 8.4s · v1.0.0',               kind: 'up' },
                  { l: 'collector-us-west-01', s: 'online',   icon: ServerCog, sub: '318 devices · poll 9.1s · v1.0.0',               kind: 'up' },
                  { l: 'collector-eu-01',      s: 'online',   icon: ServerCog, sub: '402 devices · poll 7.9s · v1.0.0',               kind: 'up' },
                  { l: 'collector-apac-01',    s: 'degraded', icon: ServerCog, sub: '182 devices · poll 14.2s · v0.9.7 — upgrade pending', kind: 'warn' },
                ] as { l: string; s: string; icon: LucideIcon; sub: string; kind: StatusKind }[]
              ).map((x) => <OverviewRow key={x.l} {...x} />)}
            </Panel>

            <Panel title="Integrations" subtitle="Notifications, webhooks, ITSM">
              {(
                [
                  { l: 'Slack · #noc-critical',    s: 'active', icon: Webhook, sub: 'sev: critical, major',               kind: 'up' },
                  { l: 'Telegram · @noc_alerts',   s: 'active', icon: Send,    sub: 'bot: SignalScope · sev: critical',    kind: 'up' },
                  { l: 'Microsoft Teams · NOC',     s: 'active', icon: Webhook, sub: 'sev: critical',                      kind: 'up' },
                  { l: 'PagerDuty',                 s: 'active', icon: Webhook, sub: 'escalation policy: NOC-24x7',        kind: 'up' },
                  { l: 'ServiceNow ITSM',           s: 'active', icon: Webhook, sub: 'auto-create P1/P2 incidents',        kind: 'up' },
                  { l: 'SMTP · alerts@',            s: 'active', icon: Mail,    sub: 'daily digest 07:00 UTC',             kind: 'up' },
                ] as { l: string; s: string; icon: LucideIcon; sub: string; kind: StatusKind }[]
              ).map((x) => <OverviewRow key={x.l} {...x} />)}
            </Panel>
          </div>
        )}

        {/* ── OIDC / SSO ───────────────────────────────────────────────────── */}
        {tab === 'oidc' && (
          <>
            {oidcError && !showProviderForm && (
              <div className="mb-4 rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{oidcError}</div>
            )}
            <Panel title="Identity Providers">
              {oidcLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
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
                            <button onClick={() => openEditProvider(p)} className="rounded p-1 hover:bg-elevated">
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => setOidcDeleteId(p.id)} className="rounded p-1 hover:bg-elevated">
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
          </>
        )}

        {/* ── Users ────────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <>
            {usersError && !showUserForm && (
              <div className="mb-4 rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{usersError}</div>
            )}
            <Panel title="User Accounts">
              {usersLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b border-border">
                      {['Name', 'Email', 'Role', 'Status', 'Grants', ''].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-elevated/40">
                        <td className="px-3 py-2 font-medium">
                          {u.firstName ? `${u.firstName} ${u.lastName ?? ''}`.trim() : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{u.email}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${ROLE_COLOR[u.role] ?? ''}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.isActive ? 'bg-success/15 text-success' : 'bg-muted/40 text-muted-foreground'}`}>
                            {u.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => openGrants(u.id)}
                            className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] hover:bg-elevated">
                            <ShieldPlus className="h-3 w-3" /> Manage
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditUser(u)} className="rounded p-1 hover:bg-elevated">
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => setDeleteUserId(u.id)} className="rounded p-1 hover:bg-elevated">
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
          </>
        )}

        {tab === 'collectors'  && <ComingSoon title="Collector Management" />}
        {tab === 'integrations' && <ComingSoon title="Integration Management" />}

        {/* ── Discovery ─────────────────────────────────────────────────── */}
        {tab === 'discovery' && (
          <div className="space-y-4">
            <Panel title="Discovery Agents" subtitle="Scan ranges, credentials, scheduling">
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Discovery is managed on the dedicated page.
                </p>
                <a
                  href="/discovery"
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  Open Discovery →
                </a>
              </div>
            </Panel>
          </div>
        )}

      </main>

      {/* ── OIDC: Add / Edit modal ──────────────────────────────────────────── */}
      {showProviderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{oidcEditId !== null ? 'Edit Provider' : 'Add Provider'}</h2>
              <button onClick={() => setShowProviderForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            {oidcError && (
              <div className="mb-3 rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{oidcError}</div>
            )}
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              <Field label="Name">
                <input value={providerForm.name} onChange={(e) => setProviderField('name', e.target.value)} className="input" />
              </Field>
              <Field label="Provider Type">
                <select value={providerForm.providerType} onChange={(e) => setProviderField('providerType', e.target.value as ProviderType)} className="input">
                  {PROVIDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <div className="rounded-md bg-elevated/50 px-3 py-2 text-[11px] text-muted-foreground">
                {PROVIDER_HELP[providerForm.providerType]}
              </div>
              <Field label="Button Text">
                <input value={providerForm.buttonText} onChange={(e) => setProviderField('buttonText', e.target.value)} className="input" />
              </Field>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={providerForm.isEnabled} onChange={(e) => setProviderField('isEnabled', e.target.checked)} />
                Enabled
              </label>
              {isTelegram ? (
                <>
                  <Field label="Bot Token (from @BotFather)">
                    <input type="password" value={providerForm.botToken} onChange={(e) => setProviderField('botToken', e.target.value)} className="input" />
                  </Field>
                  <Field label="Bot Username (without @)">
                    <input value={providerForm.botUsername} onChange={(e) => setProviderField('botUsername', e.target.value)} className="input" placeholder="mybotname" />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Client ID">
                    <input value={providerForm.clientId} onChange={(e) => setProviderField('clientId', e.target.value)} className="input" />
                  </Field>
                  <Field label="Client Secret">
                    <input type="password" value={providerForm.clientSecret} onChange={(e) => setProviderField('clientSecret', e.target.value)} className="input" />
                  </Field>
                  <Field label={`Discovery URL${isAutoDiscovery ? ' (auto-set)' : ''}`}>
                    <input
                      value={providerForm.discoveryUrl}
                      onChange={(e) => setProviderField('discoveryUrl', e.target.value)}
                      className="input" readOnly={isAutoDiscovery}
                      placeholder="https://…/.well-known/openid-configuration"
                    />
                  </Field>
                  {!isAutoDiscovery && (
                    <>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Manual endpoint overrides (optional)
                        </summary>
                        <div className="mt-2 space-y-2 border-l border-border pl-2">
                          <Field label="Authorization Endpoint">
                            <input value={providerForm.authorizationEndpoint} onChange={(e) => setProviderField('authorizationEndpoint', e.target.value)} className="input" />
                          </Field>
                          <Field label="Token Endpoint">
                            <input value={providerForm.tokenEndpoint} onChange={(e) => setProviderField('tokenEndpoint', e.target.value)} className="input" />
                          </Field>
                          <Field label="Userinfo Endpoint">
                            <input value={providerForm.userinfoEndpoint} onChange={(e) => setProviderField('userinfoEndpoint', e.target.value)} className="input" />
                          </Field>
                        </div>
                      </details>
                      <Field label="Scopes">
                        <input value={providerForm.scopes} onChange={(e) => setProviderField('scopes', e.target.value)} className="input" placeholder="openid email profile" />
                      </Field>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowProviderForm(false)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-elevated">Cancel</button>
              <button onClick={saveProvider} disabled={oidcSaving} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50">
                {oidcSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Check className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OIDC: Delete confirm ─────────────────────────────────────────────── */}
      {oidcDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <h2 className="mb-2 text-sm font-semibold">Delete Provider</h2>
            <p className="mb-5 text-xs text-muted-foreground">This will permanently remove the provider and all linked accounts.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOidcDeleteId(null)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-elevated">Cancel</button>
              <button onClick={() => deleteProvider(oidcDeleteId)} className="h-8 rounded-md bg-critical px-3 text-xs text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Users: Add / Edit modal ──────────────────────────────────────────── */}
      {showUserForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{editUser ? 'Edit User' : 'Add User'}</h2>
              <button onClick={() => setShowUserForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            {usersError && (
              <div className="mb-3 rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{usersError}</div>
            )}
            <div className="space-y-3">
              {!editUser && (
                <Field label="Email">
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="input" required />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label="First Name">
                  <input value={userForm.firstName} onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} className="input" />
                </Field>
                <Field label="Last Name">
                  <input value={userForm.lastName} onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} className="input" />
                </Field>
              </div>
              <Field label="Age">
                <input type="number" value={userForm.age} onChange={(e) => setUserForm({ ...userForm, age: e.target.value })} className="input" min={1} max={120} />
              </Field>
              <Field label="Role">
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="input">
                  {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
                </select>
              </Field>
              <Field label={editUser ? 'New Password (leave blank to keep)' : 'Password'}>
                <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="input" />
              </Field>
              {editUser && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={userForm.isActive} onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })} />
                  Active
                </label>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowUserForm(false)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-elevated">Cancel</button>
              <button onClick={saveUser} disabled={userSaving} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50">
                {userSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Check className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Users: Delete confirm ────────────────────────────────────────────── */}
      {deleteUserId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <h2 className="mb-2 text-sm font-semibold">Delete User</h2>
            <p className="mb-5 text-xs text-muted-foreground">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteUserId(null)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-elevated">Cancel</button>
              <button onClick={() => deleteUser(deleteUserId)} className="h-8 rounded-md bg-critical px-3 text-xs text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Users: Access Grants modal ───────────────────────────────────────── */}
      {grantsUserId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Access Grants — {users.find((u) => u.id === grantsUserId)?.email}
              </h2>
              <button onClick={() => setGrantsUserId(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="mb-4 space-y-2">
              {grants.length === 0 ? (
                <p className="text-xs text-muted-foreground">No grants yet. Full access is determined by role.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-1 text-left">Resource</th>
                      <th className="pb-1 text-left">ID / Value</th>
                      <th className="pb-1 text-left">Permission</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {grants.map((g) => (
                      <tr key={g.id}>
                        <td className="py-1.5 pr-2 capitalize">{g.resourceType}</td>
                        <td className="py-1.5 pr-2 font-mono text-muted-foreground">{g.resourceId ?? '(all)'}</td>
                        <td className="py-1.5 pr-2 capitalize">{g.permission}</td>
                        <td className="py-1.5 text-right">
                          <button onClick={() => removeGrant(g.id)}>
                            <ShieldMinus className="h-3.5 w-3.5 text-critical/70" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add Grant</p>
              <div className="flex gap-2">
                <select value={newGrant.resourceType} onChange={(e) => setNewGrant({ ...newGrant, resourceType: e.target.value })} className="input flex-1">
                  {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input placeholder="Resource ID (optional)" value={newGrant.resourceId} onChange={(e) => setNewGrant({ ...newGrant, resourceId: e.target.value })} className="input flex-1" />
                <select value={newGrant.permission} onChange={(e) => setNewGrant({ ...newGrant, permission: e.target.value })} className="input w-24">
                  {PERMISSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button onClick={addGrant} className="h-9 rounded-md bg-primary px-3 text-xs text-primary-foreground">Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
