'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, X, Check, Loader2,
  ShieldPlus, ShieldMinus,
  KeyRound, Users, Lock, ServerCog, Webhook, Mail, Send,
  Play, AlertCircle, CheckCircle2, Hash, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import { API_URL } from '@/lib/api';
import { getMe } from '@/lib/auth-client';
import type { OidcProviderDto, UserDto } from '@/lib/auth-client';
import type { StatusKind } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'profile' | 'oidc' | 'users' | 'collectors' | 'integrations' | 'discovery';

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
  role: string; password: string; isActive: boolean;
}

interface EmailIntegration {
  enabled: boolean;
  host: string;
  port: string;
  security: 'starttls' | 'ssl' | 'none';
  username: string;
  password: string;
  fromName: string;
  fromAddress: string;
}

interface TelegramIntegration {
  enabled: boolean;
  botToken: string;
  defaultChatId: string;
}

interface SlackIntegration {
  enabled: boolean;
  botToken: string;
  defaultChannel: string;
}

type IntegrationKind = 'email' | 'telegram' | 'slack';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',     label: 'Overview'     },
  { key: 'profile',      label: 'Profile'      },
  { key: 'oidc',         label: 'OIDC / SSO'   },
  { key: 'users',        label: 'Users'         },
  { key: 'collectors',   label: 'Collectors'   },
  { key: 'integrations', label: 'Integrations' },
  { key: 'discovery',    label: 'Discovery'    },
];

const TAB_SUBTITLES: Record<Tab, string> = {
  overview:     'Authentication, RBAC, collectors, integrations, audit',
  profile:      'Your name, avatar, and security settings',
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
  return { email: '', firstName: '', lastName: '', role: 'viewer', password: '', isActive: true };
}

function defaultEmailForm(): EmailIntegration {
  return { enabled: false, host: '', port: '587', security: 'starttls', username: '', password: '', fromName: 'SignalScope NMS', fromAddress: '' };
}
function defaultTelegramForm(): TelegramIntegration {
  return { enabled: false, botToken: '', defaultChatId: '' };
}
function defaultSlackForm(): SlackIntegration {
  return { enabled: false, botToken: '', defaultChannel: '#noc-alerts' };
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

interface OverviewRowProps { l: string; s: string; sub: string; icon: LucideIcon; kind: StatusKind; onDetail?: () => void; }

function OverviewRow({ l, s, sub, icon: Icon, kind, onDetail }: OverviewRowProps) {
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
      <div className="flex shrink-0 items-center gap-1.5">
        <StatusPill kind={kind}>{s}</StatusPill>
        {onDetail && (
          <button
            onClick={onDetail}
            title="Open settings"
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
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

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profileUser,    setProfileUser]    = useState<UserDto | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoaded,  setProfileLoaded]  = useState(false);
  const [profileError,   setProfileError]   = useState<string | null>(null);
  const [profileForm,    setProfileForm]    = useState({ firstName: '', lastName: '' });
  const [profileSaving,  setProfileSaving]  = useState(false);
  const [profileSaved,   setProfileSaved]   = useState(false);
  const [avatarPreview,  setAvatarPreview]  = useState<string | null>(null);

  // ── Integrations state ─────────────────────────────────────────────────────
  const [integrationsLoaded,  setIntegrationsLoaded]  = useState(false);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [integrationsError,   setIntegrationsError]   = useState<string | null>(null);
  const [emailConfig,    setEmailConfig]    = useState<EmailIntegration | null>(null);
  const [telegramConfig, setTelegramConfig] = useState<TelegramIntegration | null>(null);
  const [slackConfig,    setSlackConfig]    = useState<SlackIntegration | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationKind | null>(null);
  const [emailForm,    setEmailForm]    = useState<EmailIntegration>(defaultEmailForm());
  const [telegramForm, setTelegramForm] = useState<TelegramIntegration>(defaultTelegramForm());
  const [slackForm,    setSlackForm]    = useState<SlackIntegration>(defaultSlackForm());
  const [integrationSaving,  setIntegrationSaving]  = useState(false);
  const [integrationTesting, setIntegrationTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testEmail,  setTestEmail]  = useState('');

  // Lazy-load tab data on first switch
  useEffect(() => {
    if (tab === 'profile'      && !profileLoaded)       loadProfile();
    if (tab === 'oidc'         && !oidcLoaded)          loadProviders();
    if (tab === 'users'        && !usersLoaded)         loadUsers();
    if (tab === 'integrations' && !integrationsLoaded)  loadIntegrations();
  }, [tab]);

  // ── Profile handlers ──────────────────────────────────────────────────────

  async function loadProfile() {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const me = await getMe();
      setProfileUser(me);
      setProfileForm({ firstName: me.firstName ?? '', lastName: me.lastName ?? '' });
      setProfileLoaded(true);
    } catch (e: any) {
      setProfileError(e.message);
    } finally {
      setProfileLoading(false);
    }
  }

  async function saveProfile() {
    if (!profileUser) return;
    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      await apiCall(`/users/${profileUser.id}`, 'PUT', {
        firstName: profileForm.firstName || null,
        lastName:  profileForm.lastName  || null,
        role:      profileUser.role,
        isActive:  profileUser.isActive,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (e: any) {
      setProfileError(e.message);
    } finally {
      setProfileSaving(false);
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setAvatarPreview(URL.createObjectURL(file));
  }

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
      role: u.role, password: '', isActive: u.isActive,
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
        lastName:  userForm.lastName  || null,
        role:      userForm.role,
        isActive:  userForm.isActive,
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

  // ── Integration handlers ───────────────────────────────────────────────────

  async function loadIntegrations() {
    setIntegrationsLoading(true);
    setIntegrationsError(null);
    try {
      const [email, telegram, slack] = await Promise.all([
        apiCall('/integrations/email',    'GET').catch(() => null),
        apiCall('/integrations/telegram', 'GET').catch(() => null),
        apiCall('/integrations/slack',    'GET').catch(() => null),
      ]);
      if (email)    setEmailConfig(email);
      if (telegram) setTelegramConfig(telegram);
      if (slack)    setSlackConfig(slack);
      setIntegrationsLoaded(true);
    } catch (e: any) {
      setIntegrationsError(e.message);
    } finally {
      setIntegrationsLoading(false);
    }
  }

  function openIntegrationEdit(kind: IntegrationKind) {
    setTestResult(null);
    setTestEmail('');
    setIntegrationsError(null);
    if (kind === 'email')    setEmailForm(emailConfig       ?? defaultEmailForm());
    if (kind === 'telegram') setTelegramForm(telegramConfig ?? defaultTelegramForm());
    if (kind === 'slack')    setSlackForm(slackConfig       ?? defaultSlackForm());
    setEditingIntegration(kind);
  }

  async function saveIntegration() {
    if (!editingIntegration) return;
    setIntegrationSaving(true);
    setIntegrationsError(null);
    try {
      const body = editingIntegration === 'email'    ? emailForm
                 : editingIntegration === 'telegram' ? telegramForm
                 : slackForm;
      const saved = await apiCall(`/integrations/${editingIntegration}`, 'PUT', body);
      if (editingIntegration === 'email')    setEmailConfig(saved);
      if (editingIntegration === 'telegram') setTelegramConfig(saved);
      if (editingIntegration === 'slack')    setSlackConfig(saved);
      setEditingIntegration(null);
    } catch (e: any) {
      setIntegrationsError(e.message);
    } finally {
      setIntegrationSaving(false);
    }
  }

  async function testIntegration() {
    if (!editingIntegration) return;
    setIntegrationTesting(true);
    setTestResult(null);
    try {
      const body = editingIntegration === 'email'
        ? { ...emailForm, testRecipient: testEmail || emailForm.username }
        : editingIntegration === 'telegram' ? telegramForm : slackForm;
      await apiCall(`/integrations/${editingIntegration}/test`, 'POST', body);
      setTestResult({ ok: true, message: 'Test message sent successfully.' });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setIntegrationTesting(false);
    }
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
            <Panel
              title="Authentication"
              subtitle="SSO · OAuth2 · OIDC · LDAP · MFA"
              actions={<TabLink label="Manage" onClick={() => setTab('oidc')} />}
            >
              {(
                [
                  { l: 'Azure AD (OIDC)',        s: 'connected', icon: KeyRound, sub: 'tenant: signalscope.io · 412 users',     kind: 'up',  tab: 'oidc'    as Tab },
                  { l: 'LDAP / Active Directory', s: 'connected', icon: Users,    sub: 'corp.local · sync 5m',                    kind: 'up',  tab: 'oidc'    as Tab },
                  { l: 'MFA · TOTP + WebAuthn',   s: 'enforced',  icon: Lock,     sub: 'all users · 38 enrolled this week',       kind: 'up',  tab: 'profile' as Tab },
                ] as { l: string; s: string; icon: LucideIcon; sub: string; kind: StatusKind; tab: Tab }[]
              ).map((x) => <OverviewRow key={x.l} {...x} onDetail={() => setTab(x.tab)} />)}
            </Panel>

            <Panel
              title="RBAC Roles"
              subtitle="Least-privilege · approval workflows on write actions"
              actions={<TabLink label="Manage" onClick={() => setTab('users')} />}
            >
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

            <Panel
              title="Distributed Collectors"
              subtitle="4 online · 1,314 devices balanced"
              actions={<TabLink label="Manage" onClick={() => setTab('collectors')} />}
            >
              {(
                [
                  { l: 'collector-us-east-01', s: 'online',   icon: ServerCog, sub: '412 devices · poll 8.4s · v1.0.0',               kind: 'up' },
                  { l: 'collector-us-west-01', s: 'online',   icon: ServerCog, sub: '318 devices · poll 9.1s · v1.0.0',               kind: 'up' },
                  { l: 'collector-eu-01',      s: 'online',   icon: ServerCog, sub: '402 devices · poll 7.9s · v1.0.0',               kind: 'up' },
                  { l: 'collector-apac-01',    s: 'degraded', icon: ServerCog, sub: '182 devices · poll 14.2s · v0.9.7 — upgrade pending', kind: 'warn' },
                ] as { l: string; s: string; icon: LucideIcon; sub: string; kind: StatusKind }[]
              ).map((x) => <OverviewRow key={x.l} {...x} onDetail={() => setTab('collectors')} />)}
            </Panel>

            <Panel
              title="Integrations"
              subtitle="Notifications, webhooks, ITSM"
              actions={<TabLink label="Manage" onClick={() => setTab('integrations')} />}
            >
              {(
                [
                  { l: 'Slack · #noc-critical',    s: 'active', icon: Webhook, sub: 'sev: critical, major',               kind: 'up' },
                  { l: 'Telegram · @noc_alerts',   s: 'active', icon: Send,    sub: 'bot: SignalScope · sev: critical',    kind: 'up' },
                  { l: 'Microsoft Teams · NOC',     s: 'active', icon: Webhook, sub: 'sev: critical',                      kind: 'up' },
                  { l: 'PagerDuty',                 s: 'active', icon: Webhook, sub: 'escalation policy: NOC-24x7',        kind: 'up' },
                  { l: 'ServiceNow ITSM',           s: 'active', icon: Webhook, sub: 'auto-create P1/P2 incidents',        kind: 'up' },
                  { l: 'SMTP · alerts@',            s: 'active', icon: Mail,    sub: 'daily digest 07:00 UTC',             kind: 'up' },
                ] as { l: string; s: string; icon: LucideIcon; sub: string; kind: StatusKind }[]
              ).map((x) => <OverviewRow key={x.l} {...x} onDetail={() => setTab('integrations')} />)}
            </Panel>
          </div>
        )}

        {/* ── Profile ──────────────────────────────────────────────────────── */}
        {tab === 'profile' && (
          <div className="mx-auto max-w-lg space-y-4">
            {profileError && (
              <div className="rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{profileError}</div>
            )}
            {profileLoading ? (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : (
              <Panel title="My Profile" subtitle="Update your display name and avatar">
                {/* Avatar */}
                <div className="mb-6 flex items-center gap-4">
                  <div className="relative">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar preview" className="h-16 w-16 rounded-full object-cover ring-2 ring-border" />
                    ) : (
                      <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/20 text-xl font-semibold text-primary">
                        {profileUser
                          ? ((profileForm.firstName?.[0] ?? '') + (profileForm.lastName?.[0] ?? '') || profileUser.email[0]).toUpperCase()
                          : '?'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 text-xs font-medium hover:bg-elevated">
                      Upload photo
                      <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
                    </label>
                    <p className="mt-1 text-[10px] text-muted-foreground">JPG, PNG or WebP · max 2 MB</p>
                  </div>
                </div>

                {/* Read-only identity */}
                <div className="mb-4 space-y-3">
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Username / Email</p>
                    <p className="rounded-md border border-border bg-elevated/40 px-3 py-2 text-xs text-muted-foreground font-mono">
                      {profileUser?.email ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Role</p>
                    <p className="text-xs">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${ROLE_COLOR[profileUser?.role ?? ''] ?? 'bg-muted/40 text-muted-foreground'}`}>
                        {profileUser?.role ?? '—'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Editable name */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name">
                    <input
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                      className="input"
                      placeholder="Jane"
                    />
                  </Field>
                  <Field label="Last Name">
                    <input
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                      className="input"
                      placeholder="Smith"
                    />
                  </Field>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={saveProfile}
                    disabled={profileSaving}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90"
                  >
                    {profileSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <Check className="h-3.5 w-3.5" /> Save changes
                  </button>
                  {profileSaved && (
                    <span className="text-xs text-success">Changes saved.</span>
                  )}
                </div>
              </Panel>
            )}
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

        {/* ── Integrations ──────────────────────────────────────────────────── */}
        {tab === 'integrations' && (
          <div className="space-y-4">
            {integrationsError && !editingIntegration && (
              <div className="rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{integrationsError}</div>
            )}
            {integrationsLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : (
              <>
                <IntegrationCard
                  title="Email / SMTP"
                  subtitle="Outbound mailbox for alerts and scheduled reports"
                  icon={Mail}
                  config={emailConfig}
                  summary={emailConfig ? `${emailConfig.host}:${emailConfig.port} · ${emailConfig.fromAddress || emailConfig.username}` : undefined}
                  onConfigure={() => openIntegrationEdit('email')}
                />
                <IntegrationCard
                  title="Telegram Bot"
                  subtitle="Send alerts and reports to Telegram channels or groups"
                  icon={Send}
                  config={telegramConfig}
                  summary={telegramConfig ? `Chat ID: ${telegramConfig.defaultChatId}` : undefined}
                  onConfigure={() => openIntegrationEdit('telegram')}
                />
                <IntegrationCard
                  title="Slack Bot"
                  subtitle="Post alerts and reports to Slack channels"
                  icon={Hash}
                  config={slackConfig}
                  summary={slackConfig ? `Channel: ${slackConfig.defaultChannel}` : undefined}
                  onConfigure={() => openIntegrationEdit('slack')}
                />
              </>
            )}
          </div>
        )}

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
      {/* ── Integration: Configure modal ─────────────────────────────────────── */}
      {editingIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {editingIntegration === 'email' ? 'Email / SMTP'
                  : editingIntegration === 'telegram' ? 'Telegram Bot'
                  : 'Slack Bot'}
              </h2>
              <button onClick={() => setEditingIntegration(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            {integrationsError && (
              <div className="mb-3 rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{integrationsError}</div>
            )}

            <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">

              {/* Email fields */}
              {editingIntegration === 'email' && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Field label="SMTP Host">
                        <input value={emailForm.host} onChange={(e) => setEmailForm({ ...emailForm, host: e.target.value })} className="input" placeholder="smtp.example.com" />
                      </Field>
                    </div>
                    <Field label="Port">
                      <input type="number" value={emailForm.port} onChange={(e) => setEmailForm({ ...emailForm, port: e.target.value })} className="input" placeholder="587" />
                    </Field>
                  </div>
                  <Field label="Security">
                    <select value={emailForm.security} onChange={(e) => setEmailForm({ ...emailForm, security: e.target.value as EmailIntegration['security'] })} className="input">
                      <option value="starttls">STARTTLS (recommended · port 587)</option>
                      <option value="ssl">SSL / TLS (port 465)</option>
                      <option value="none">None / plaintext (port 25)</option>
                    </select>
                  </Field>
                  <Field label="Username (mailbox address)">
                    <input type="email" value={emailForm.username} onChange={(e) => setEmailForm({ ...emailForm, username: e.target.value })} className="input" placeholder="alerts@example.com" />
                  </Field>
                  <Field label="Password">
                    <input type="password" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} className="input" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="From Name">
                      <input value={emailForm.fromName} onChange={(e) => setEmailForm({ ...emailForm, fromName: e.target.value })} className="input" placeholder="SignalScope NMS" />
                    </Field>
                    <Field label="From Address">
                      <input type="email" value={emailForm.fromAddress} onChange={(e) => setEmailForm({ ...emailForm, fromAddress: e.target.value })} className="input" placeholder="alerts@example.com" />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={emailForm.enabled} onChange={(e) => setEmailForm({ ...emailForm, enabled: e.target.checked })} />
                    Enabled
                  </label>
                  <div className="border-t border-border pt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Send Test Email</p>
                    <div className="flex gap-2">
                      <input type="email" placeholder="recipient@example.com" value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)} className="input flex-1" />
                      <button onClick={testIntegration} disabled={integrationTesting}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-panel px-3 text-xs hover:bg-elevated disabled:opacity-50">
                        {integrationTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        Test
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Telegram fields */}
              {editingIntegration === 'telegram' && (
                <>
                  <Field label="Bot Token (from @BotFather)">
                    <input type="password" value={telegramForm.botToken}
                      onChange={(e) => setTelegramForm({ ...telegramForm, botToken: e.target.value })}
                      className="input" placeholder="123456789:AABBcc…" />
                  </Field>
                  <Field label="Default Chat ID">
                    <input value={telegramForm.defaultChatId}
                      onChange={(e) => setTelegramForm({ ...telegramForm, defaultChatId: e.target.value })}
                      className="input" placeholder="-1001234567890 or @channelname" />
                  </Field>
                  <p className="text-[11px] text-muted-foreground">
                    Use a negative chat ID for groups/supergroups/channels. Add the bot to the channel and grant it posting permissions before testing.
                  </p>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={telegramForm.enabled} onChange={(e) => setTelegramForm({ ...telegramForm, enabled: e.target.checked })} />
                    Enabled
                  </label>
                  <div className="border-t border-border pt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Send Test Message</p>
                    <button onClick={testIntegration} disabled={integrationTesting}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-panel px-3 text-xs hover:bg-elevated disabled:opacity-50">
                      {integrationTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      Send to {telegramForm.defaultChatId || 'default chat'}
                    </button>
                  </div>
                </>
              )}

              {/* Slack fields */}
              {editingIntegration === 'slack' && (
                <>
                  <Field label="Bot Token (xoxb-…)">
                    <input type="password" value={slackForm.botToken}
                      onChange={(e) => setSlackForm({ ...slackForm, botToken: e.target.value })}
                      className="input" placeholder="xoxb-…" />
                  </Field>
                  <Field label="Default Channel">
                    <input value={slackForm.defaultChannel}
                      onChange={(e) => setSlackForm({ ...slackForm, defaultChannel: e.target.value })}
                      className="input" placeholder="#noc-alerts" />
                  </Field>
                  <p className="text-[11px] text-muted-foreground">
                    Create a Slack app, add the <code className="font-mono text-[10px]">chat:write</code> scope, install it to your workspace, then invite the bot to the channel with <code className="font-mono text-[10px]">/invite @botname</code>.
                  </p>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={slackForm.enabled} onChange={(e) => setSlackForm({ ...slackForm, enabled: e.target.checked })} />
                    Enabled
                  </label>
                  <div className="border-t border-border pt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Send Test Message</p>
                    <button onClick={testIntegration} disabled={integrationTesting}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-panel px-3 text-xs hover:bg-elevated disabled:opacity-50">
                      {integrationTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      Send to {slackForm.defaultChannel || 'default channel'}
                    </button>
                  </div>
                </>
              )}

              {/* Test result banner */}
              {testResult && (
                <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${testResult.ok ? 'bg-success/10 text-success' : 'bg-critical/10 text-critical'}`}>
                  {testResult.ok
                    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    : <AlertCircle  className="h-3.5 w-3.5 shrink-0" />}
                  {testResult.message}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditingIntegration(null)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-elevated">Cancel</button>
              <button onClick={saveIntegration} disabled={integrationSaving}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50">
                {integrationSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Check className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── TabLink ─────────────────────────────────────────────────────────────────

function TabLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
    >
      {label} <ChevronRight className="h-3 w-3" />
    </button>
  );
}

// ─── IntegrationCard ──────────────────────────────────────────────────────────

interface IntegrationCardProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  config: { enabled: boolean } | null;
  summary?: string;
  onConfigure: () => void;
}

function IntegrationCard({ title, subtitle, icon: Icon, config, summary, onConfigure }: IntegrationCardProps) {
  return (
    <Panel
      title={title}
      subtitle={subtitle}
      actions={
        <div className="flex items-center gap-2">
          {config ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.enabled ? 'bg-success/15 text-success' : 'bg-muted/40 text-muted-foreground'}`}>
              {config.enabled ? 'active' : 'disabled'}
            </span>
          ) : (
            <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">not set</span>
          )}
          <button onClick={onConfigure}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 text-[11px] hover:bg-elevated">
            {config ? <><Pencil className="h-3 w-3" /> Edit</> : 'Configure'}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-elevated">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {summary ? (
          <p className="text-xs text-muted-foreground font-mono leading-relaxed">{summary}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Not configured</p>
        )}
      </div>
    </Panel>
  );
}
