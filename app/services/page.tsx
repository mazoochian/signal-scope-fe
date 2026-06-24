'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings2, Plus, Pencil, Trash2, X, Check, Loader2,
} from 'lucide-react';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import { Sparkline } from '@/components/charts/sparkline';
import { API_URL } from '@/lib/api';
import type { StatusKind } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service {
  name: string; owner: string; sla: number; health: number;
  kind: StatusKind; deps: string[]; trend: number[];
}

interface SlaParameter {
  id: number; name: string; metric: string;
  target_value: number; operator: string;
  scope_type: string; scope_value: string | null; enabled: boolean;
}

interface SlaStatusItem {
  parameter: SlaParameter;
  currentValue: number | null;
  targetMet: boolean | null;
}

interface SlaForm {
  name: string; metric: string; target_value: string;
  operator: string; scope_type: string; scope_value: string; enabled: boolean;
}

const METRICS = ['availability', 'latency', 'packet_loss', 'cpu', 'memory', 'interface_util'] as const;
const METRIC_LABELS: Record<string, string> = {
  availability: 'Availability (%)', latency: 'Latency (ms)',
  packet_loss: 'Packet Loss (%)', cpu: 'CPU Utilization (%)',
  memory: 'Memory Utilization (%)', interface_util: 'Interface Utilization (%)',
};
const OPERATORS = ['>=', '<=', '='] as const;
const SCOPE_TYPES = ['all', 'site', 'device', 'role'] as const;

function defaultForm(): SlaForm {
  return { name: '', metric: 'availability', target_value: '', operator: '>=', scope_type: 'all', scope_value: '', enabled: true };
}

// ─── MetricBox ─────────────────────────────────────────────────────────────────

function MetricBox({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-md border border-border bg-elevated/40 p-2 text-center">
      <div className="text-muted-foreground uppercase tracking-wide text-[9px]">{l}</div>
      <div className="mt-0.5 font-mono">{v}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  // SLA modal
  const [showSlaModal, setShowSlaModal] = useState(false);
  const [slaParams, setSlaParams] = useState<SlaParameter[]>([]);
  const [slaStatus, setSlaStatus] = useState<SlaStatusItem[]>([]);
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaError, setSlaError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<SlaForm>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // SLA compliance summary
  const totalEnabled = slaStatus.length;
  const met = slaStatus.filter((i) => i.targetMet === true).length;
  const compliancePct = totalEnabled > 0 ? Math.round((met / totalEnabled) * 1000) / 10 : null;

  useEffect(() => {
    fetch(`${API_URL}/api/services`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setServices)
      .catch(() => {})
      .finally(() => setServicesLoading(false));
  }, []);

  const loadSla = useCallback(async () => {
    setSlaLoading(true);
    setSlaError(null);
    try {
      const [params, status] = await Promise.all([
        fetch(`${API_URL}/api/sla/parameters`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`${API_URL}/api/sla/status`, { credentials: 'include' }).then((r) => r.json()),
      ]);
      setSlaParams(params ?? []);
      setSlaStatus(status ?? []);
    } catch (e: unknown) {
      setSlaError(e instanceof Error ? e.message : 'Failed to load SLA data');
    } finally {
      setSlaLoading(false);
    }
  }, []);

  function openAdd() {
    setForm(defaultForm()); setEditId(null); setSlaError(null); setShowForm(true);
  }

  function openEdit(p: SlaParameter) {
    setForm({
      name: p.name, metric: p.metric, target_value: String(p.target_value),
      operator: p.operator, scope_type: p.scope_type,
      scope_value: p.scope_value ?? '', enabled: p.enabled,
    });
    setEditId(p.id); setSlaError(null); setShowForm(true);
  }

  async function saveSla() {
    setSaving(true); setSlaError(null);
    try {
      const body = {
        name: form.name, metric: form.metric,
        target_value: parseFloat(form.target_value),
        operator: form.operator, scope_type: form.scope_type,
        scope_value: form.scope_value || null, enabled: form.enabled,
      };
      const url = editId !== null
        ? `${API_URL}/api/sla/parameters/${editId}`
        : `${API_URL}/api/sla/parameters`;
      const res = await fetch(url, {
        method: editId !== null ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setShowForm(false);
      loadSla();
    } catch (e: unknown) {
      setSlaError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(id: number) {
    const res = await fetch(`${API_URL}/api/sla/parameters/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { setDeleteId(null); loadSla(); }
  }

  function getStatusForParam(id: number): SlaStatusItem | undefined {
    return slaStatus.find((s) => s.parameter.id === id);
  }

  if (servicesLoading) {
    return (
      <>
        <TopBar title="Service Assurance" />
        <PageHeader title="Service Assurance" subtitle="Business services modeled as dependency graphs with rolled-up SLA" />
        <main className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Service Assurance" />
      <PageHeader
        title="Service Assurance"
        subtitle={compliancePct !== null
          ? `SLA Compliance: ${compliancePct}% (${met}/${totalEnabled} parameters met)`
          : 'Business services modeled as dependency graphs with rolled-up SLA'}
        actions={
          <button
            onClick={() => { setShowSlaModal(true); loadSla(); }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-panel px-3 text-xs hover:bg-elevated"
          >
            <Settings2 className="h-3.5 w-3.5" /> SLA Parameters
          </button>
        }
      />

      <main className="flex-1 px-5 py-5">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {services.map((s) => {
            const ok = s.kind === 'up';
            const healthColor = ok
              ? 'var(--color-success)'
              : s.kind === 'warn'
              ? 'var(--color-warning)'
              : 'var(--color-critical)';
            return (
              <Panel key={s.name} title={s.name} subtitle={`Owner: ${s.owner} · SLA target ${s.sla}%`}>
                <div className="flex items-center justify-between">
                  <StatusPill kind={s.kind}>
                    {ok ? 'Healthy' : s.kind === 'warn' ? 'Degraded' : 'Breach'}
                  </StatusPill>
                  <div className="text-right">
                    <div className="font-mono text-2xl tracking-tight" style={{ color: healthColor }}>
                      {s.health.toFixed(2)}%
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Health · 30d</div>
                  </div>
                </div>
                <div className="mt-3">
                  <Sparkline data={s.trend} color={ok ? 'var(--color-success)' : 'var(--color-warning)'} height={60} />
                </div>
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Dependency chain</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {s.deps.map((dep, idx) => (
                      <span key={dep} className="flex items-center">
                        <span className="rounded-md border border-border bg-elevated px-2 py-0.5 font-mono text-[11px]">{dep}</span>
                        {idx < s.deps.length - 1 && <span className="px-1 text-muted-foreground">→</span>}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <MetricBox l="MTTR" v="14m" />
                  <MetricBox l="Incidents 30d" v={ok ? '0' : '3'} />
                  <MetricBox l="Error Budget" v={ok ? '97%' : '11%'} />
                </div>
              </Panel>
            );
          })}
        </div>
      </main>

      {/* ── SLA Parameters Modal ──────────────────────────────────────────── */}
      {showSlaModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-panel shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">SLA Parameters</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={openAdd}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[11px] text-primary-foreground">
                  <Plus className="h-3 w-3" /> Add Parameter
                </button>
                <button onClick={() => { setShowSlaModal(false); setShowForm(false); }}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="p-5">
              {slaError && !showForm && (
                <div className="mb-3 rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{slaError}</div>
              )}

              {/* Add / Edit form */}
              {showForm && (
                <div className="mb-4 rounded-lg border border-border bg-elevated/30 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {editId !== null ? 'Edit Parameter' : 'New Parameter'}
                    </p>
                    <button onClick={() => setShowForm(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                  {slaError && (
                    <div className="mb-3 rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{slaError}</div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Name</label>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. WAN Link Availability" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Metric</label>
                      <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} className="input">
                        {METRICS.map((m) => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-20">
                        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Op.</label>
                        <select value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} className="input">
                          {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Target</label>
                        <input type="number" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} className="input" placeholder="99.9" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Scope</label>
                      <select value={form.scope_type} onChange={(e) => setForm({ ...form, scope_type: e.target.value, scope_value: '' })} className="input">
                        {SCOPE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {form.scope_type !== 'all' && (
                      <div>
                        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {form.scope_type === 'site' ? 'Site Name' : form.scope_type === 'device' ? 'Device Name' : 'Role'}
                        </label>
                        <input value={form.scope_value} onChange={(e) => setForm({ ...form, scope_value: e.target.value })} className="input" />
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
                        Enabled
                      </label>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => setShowForm(false)} className="h-7 rounded-md border border-border px-3 text-xs hover:bg-elevated">Cancel</button>
                    <button onClick={saveSla} disabled={saving}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50">
                      {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                      <Check className="h-3 w-3" /> Save
                    </button>
                  </div>
                </div>
              )}

              {/* Parameters table */}
              {slaLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : slaParams.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No SLA parameters configured.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b border-border">
                      {['Name', 'Metric', 'Target', 'Scope', 'Current', 'Status', ''].map((h) => (
                        <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {slaParams.map((p) => {
                      const s = getStatusForParam(p.id);
                      const met = s?.targetMet;
                      const cur = s?.currentValue;
                      return (
                        <tr key={p.id} className={`hover:bg-elevated/40 ${!p.enabled ? 'opacity-50' : ''}`}>
                          <td className="px-2 py-2 font-medium">{p.name}</td>
                          <td className="px-2 py-2 text-muted-foreground">{METRIC_LABELS[p.metric] ?? p.metric}</td>
                          <td className="px-2 py-2 font-mono">{p.operator} {p.target_value}</td>
                          <td className="px-2 py-2 text-muted-foreground capitalize">
                            {p.scope_type}{p.scope_value ? `: ${p.scope_value}` : ''}
                          </td>
                          <td className="px-2 py-2 font-mono">
                            {cur !== null && cur !== undefined ? cur.toFixed(2) : '—'}
                          </td>
                          <td className="px-2 py-2">
                            {!p.enabled ? (
                              <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">Disabled</span>
                            ) : met === null || met === undefined ? (
                              <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">Unknown</span>
                            ) : met ? (
                              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">Met</span>
                            ) : (
                              <span className="rounded-full bg-critical/15 px-2 py-0.5 text-[10px] font-semibold text-critical">Breach</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right">
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
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <h2 className="mb-2 text-sm font-semibold">Delete SLA Parameter</h2>
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
