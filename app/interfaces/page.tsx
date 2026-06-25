'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Zap, Loader2 } from 'lucide-react';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import { MiniBars } from '@/components/charts/mini-bars';
import type { StatusKind } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface IfaceRow {
  id: number; name: string; desc: string; description: string;
  vlan: string | null; duplex: string; speed: string;
  inMbps: string; outMbps: string; errs: number; util: number;
  status: string; adminStatus: string;
  trend: number[];
}

interface InterfaceSummary {
  total: number; up: number; errorDown: number; adminDown: number;
  warn: number; throughput: string;
}

interface InterfacesData {
  interfaces: IfaceRow[];
  summary: InterfaceSummary;
}

// Resolve the visual state that drives port colour in the matrix.
type PortState = 'up' | 'warn' | 'error-down' | 'admin-down';

function portState(iface: IfaceRow): PortState {
  if (iface.adminStatus === 'down') return 'admin-down';
  if (iface.status === 'down')      return 'error-down';
  if (iface.status === 'warn')      return 'warn';
  return 'up';
}

function portBackground(state: PortState, util: number): string {
  if (state === 'admin-down') return 'var(--color-elevated)';
  if (state === 'error-down') return 'var(--color-critical)';
  if (state === 'warn')       return 'var(--color-warning)';
  // up: opacity reflects utilisation
  return 'var(--color-success)';
}

function portOpacity(state: PortState, util: number): number {
  if (state === 'admin-down') return 0.35;
  if (state === 'error-down') return 0.85;
  if (state === 'warn')       return 0.75;
  return 0.3 + (util / 100) * 0.65;
}

function portTitle(iface: IfaceRow, state: PortState): string {
  const stateLabel =
    state === 'admin-down' ? 'Admin-down'
    : state === 'error-down' ? 'Error down'
    : state === 'warn' ? 'Degraded'
    : `Up · ${iface.util}%`;
  return `${iface.name}${iface.desc ? ` · ${iface.desc}` : ''}${iface.vlan ? ` · VLAN ${iface.vlan}` : ''} · ${stateLabel}`;
}

function statusKind(iface: IfaceRow): StatusKind {
  if (iface.adminStatus === 'down') return 'muted';
  if (iface.status === 'down')      return 'down';
  if (iface.status === 'warn')      return 'warn';
  return 'up';
}

export default function InterfacesPage() {
  const [data, setData]       = useState<InterfacesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState('');
  const debounce              = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((search: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    fetch(`${API}/api/interfaces?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  // Initial load
  useEffect(() => { load(''); }, [load]);

  const handleSearch = (value: string) => {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(value), 250);
  };

  const ifaces = data?.interfaces ?? [];
  const summary = data?.summary;
  const sortedByUtil = [...ifaces].sort((a, b) => b.util - a.util).slice(0, 6);

  return (
    <>
      <TopBar title="Interfaces" />
      <PageHeader
        title="Interfaces"
        subtitle="core-sw-01 · live SNMP polling (10s)"
      />

      <main className="flex-1 px-5 py-5">
        {/* Search / filter bar */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-8 w-72 rounded-md border border-input bg-panel pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Filter name, description, VLAN…"
            />
          </div>
        </div>
        {/* Summary tiles */}
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          {summary ? (
            <>
              {[
                { l: 'Total',       v: String(summary.total),      tone: '' },
                { l: 'Up',          v: String(summary.up),         tone: 'text-success' },
                { l: 'Warn',        v: String(summary.warn),       tone: 'text-warning' },
                { l: 'Error Down',  v: String(summary.errorDown),  tone: 'text-critical' },
                { l: 'Admin Down',  v: String(summary.adminDown),  tone: 'text-muted-foreground' },
              ].map((s) => (
                <div key={s.l} className="panel flex items-center justify-between p-3">
                  <span className="text-xs text-muted-foreground">{s.l}</span>
                  <span className={`font-mono text-base ${s.tone}`}>{s.v}</span>
                </div>
              ))}
            </>
          ) : (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="panel h-14 animate-pulse bg-elevated/40" />
            ))
          )}
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading interfaces…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {/* Port matrix */}
              <Panel className="xl:col-span-2" title="Port matrix" subtitle="visual front-panel · hover for detail">
                {ifaces.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No interfaces match {q ? `"${q}"` : 'this filter'}.
                  </div>
                ) : (
                  <div className="grid grid-cols-12 gap-1.5">
                    {ifaces.map((iface) => {
                      const state = portState(iface);
                      return (
                        <div
                          key={iface.id}
                          className="aspect-square rounded-sm border border-border cursor-default"
                          style={{
                            background: portBackground(state, iface.util),
                            opacity:    portOpacity(state, iface.util),
                          }}
                          title={portTitle(iface, state)}
                        />
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                  <span className="chip" style={{ paddingLeft: '0.5rem' }}><span className="status-dot text-success" /> Up</span>
                  <span className="chip" style={{ paddingLeft: '0.5rem' }}><span className="status-dot text-warning" /> Warn / Saturated</span>
                  <span className="chip" style={{ paddingLeft: '0.5rem' }}><span className="status-dot text-critical" /> Error Down</span>
                  <span className="chip" style={{ paddingLeft: '0.5rem' }}><span className="status-dot text-muted-foreground" /> Admin Down</span>
                  <span className="chip"><Zap className="h-3 w-3 text-warning" /> PoE 732 / 800 W</span>
                </div>
              </Panel>

              {/* Top utilized */}
              <Panel title="Top utilized · 1h" subtitle="rolling window">
                <ul className="space-y-2.5">
                  {sortedByUtil.filter((i) => i.util > 0).map((iface) => (
                    <li key={iface.name}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono">{iface.name}</span>
                        <span className="font-mono text-muted-foreground">{iface.util}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                        <div
                          className="h-full"
                          style={{ width: `${iface.util}%`, background: iface.util > 85 ? 'var(--color-warning)' : 'var(--color-primary)' }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            {/* Interface table */}
            <Panel className="mt-4" title="Interface table" subtitle={loading ? 'Refreshing…' : `${ifaces.length} interfaces`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b border-border">
                      {['Port', 'Description', 'Status', 'VLAN', 'Speed', 'In', 'Out', 'Util', 'Errors', 'Trend'].map((h) => (
                        <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ifaces.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-2 py-8 text-center text-muted-foreground">
                          No interfaces match {q ? `"${q}"` : 'this filter'}.
                        </td>
                      </tr>
                    ) : ifaces.map((r) => (
                      <tr key={r.id} className={`hover:bg-elevated/40 ${r.adminStatus === 'down' ? 'opacity-60' : ''}`}>
                        <td className="px-2 py-2 font-mono">{r.name}</td>
                        <td className="px-2 py-2 text-muted-foreground">{r.desc || '—'}</td>
                        <td className="px-2 py-2">
                          {r.adminStatus === 'down'
                            ? <span className="chip text-muted-foreground border-muted-foreground/30">admin-down</span>
                            : <StatusPill kind={statusKind(r) as StatusKind}>{r.status}</StatusPill>
                          }
                        </td>
                        <td className="px-2 py-2 font-mono">{r.vlan ?? '—'}</td>
                        <td className="px-2 py-2 font-mono">{r.speed}</td>
                        <td className="px-2 py-2 font-mono text-primary">{r.adminStatus === 'down' ? '—' : `${r.inMbps}`}</td>
                        <td className="px-2 py-2 font-mono text-cyan">{r.adminStatus === 'down' ? '—' : `${r.outMbps}`}</td>
                        <td className="px-2 py-2 font-mono">{r.adminStatus === 'down' ? '—' : `${r.util}%`}</td>
                        <td className="px-2 py-2 font-mono" style={{ color: r.errs > 50 ? 'var(--color-critical)' : r.errs > 0 ? 'var(--color-warning)' : 'inherit' }}>
                          {r.errs}
                        </td>
                        <td className="px-2 py-2 w-28">
                          <MiniBars data={r.trend} height={20} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </main>
    </>
  );
}
