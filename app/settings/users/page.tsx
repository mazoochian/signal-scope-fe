'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, Loader2, ShieldPlus, ShieldMinus } from 'lucide-react';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { API_URL } from '@/lib/api';
import type { UserDto } from '@/lib/auth-client';

const ROLES = ['superadmin', 'admin', 'operator', 'troubleshooter', 'viewer'] as const;
const RESOURCE_TYPES = ['site', 'device', 'device_role', 'interface', 'all'] as const;
const PERMISSIONS = ['read', 'write', 'admin'] as const;

interface AccessGrant {
  id: number;
  resourceType: string;
  resourceId: string | null;
  permission: string;
}

interface UserForm {
  email: string;
  firstName: string;
  lastName: string;
  age: string;
  role: string;
  password: string;
  isActive: boolean;
}

const defaultForm = (): UserForm => ({
  email: '', firstName: '', lastName: '', age: '', role: 'viewer', password: '', isActive: true,
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

export default function UsersPage() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [form, setForm] = useState<UserForm>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Access grants
  const [grantsUserId, setGrantsUserId] = useState<number | null>(null);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [newGrant, setNewGrant] = useState({ resourceType: 'site', resourceId: '', permission: 'read' });

  async function load() {
    try {
      setLoading(true);
      const list = await apiCall('/users', 'GET');
      setUsers(list ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setForm(defaultForm());
    setEditUser(null);
    setError(null);
    setShowForm(true);
  }

  function openEdit(u: UserDto) {
    setForm({
      email: u.email,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      age: u.age?.toString() ?? '',
      role: u.role,
      password: '',
      isActive: u.isActive,
    });
    setEditUser(u);
    setError(null);
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body: any = {
        firstName: form.firstName || null,
        lastName: form.lastName || null,
        age: form.age ? parseInt(form.age, 10) : null,
        role: form.role,
        isActive: form.isActive,
      };
      if (form.password) body.password = form.password;
      if (!editUser) {
        body.email = form.email;
        await apiCall('/users', 'POST', body);
      } else {
        await apiCall(`/users/${editUser.id}`, 'PUT', body);
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
      await apiCall(`/users/${id}`, 'DELETE');
      setDeleteId(null);
      load();
    } catch (e: any) {
      setError(e.message);
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

  const roleColor: Record<string, string> = {
    superadmin: 'bg-critical/15 text-critical',
    admin: 'bg-warning/15 text-warning',
    operator: 'bg-primary/15 text-primary',
    troubleshooter: 'bg-success/15 text-success',
    viewer: 'bg-muted/40 text-muted-foreground',
  };

  return (
    <>
      <TopBar title="Users" />
      <PageHeader
        title="Users"
        subtitle="Manage user accounts and access control"
        actions={
          <button onClick={openAdd} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Add User
          </button>
        }
      />

      <main className="flex-1 px-5 py-5">
        {error && (
          <div className="mb-4 rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{error}</div>
        )}

        <Panel title="User Accounts">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
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
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${roleColor[u.role] ?? ''}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.isActive ? 'bg-success/15 text-success' : 'bg-muted/40 text-muted-foreground'}`}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => openGrants(u.id)}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] border border-border hover:bg-elevated"
                      >
                        <ShieldPlus className="h-3 w-3" /> Manage
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="rounded p-1 hover:bg-elevated">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeleteId(u.id)} className="rounded p-1 hover:bg-elevated">
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

      {/* Add / Edit User Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{editUser ? 'Edit User' : 'Add User'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            {error && (
              <div className="mb-3 rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{error}</div>
            )}

            <div className="space-y-3">
              {!editUser && (
                <Field label="Email">
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" required />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label="First Name">
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" />
                </Field>
                <Field label="Last Name">
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" />
                </Field>
              </div>
              <Field label="Age">
                <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="input" min={1} max={120} />
              </Field>
              <Field label="Role">
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input">
                  {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
                </select>
              </Field>
              <Field label={editUser ? 'New Password (leave blank to keep)' : 'Password'}>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" />
              </Field>
              {editUser && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  Active
                </label>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-elevated">Cancel</button>
              <button onClick={save} disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Check className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access Grants Modal */}
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
                  <thead className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
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
                <select
                  value={newGrant.resourceType}
                  onChange={(e) => setNewGrant({ ...newGrant, resourceType: e.target.value })}
                  className="input flex-1"
                >
                  {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  placeholder="Resource ID (optional)"
                  value={newGrant.resourceId}
                  onChange={(e) => setNewGrant({ ...newGrant, resourceId: e.target.value })}
                  className="input flex-1"
                />
                <select
                  value={newGrant.permission}
                  onChange={(e) => setNewGrant({ ...newGrant, permission: e.target.value })}
                  className="input w-24"
                >
                  {PERMISSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button
                  onClick={addGrant}
                  className="h-9 rounded-md bg-primary px-3 text-xs text-primary-foreground"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <h2 className="mb-2 text-sm font-semibold">Delete User</h2>
            <p className="mb-5 text-xs text-muted-foreground">This action cannot be undone.</p>
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
