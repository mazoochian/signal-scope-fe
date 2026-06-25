'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, CheckCheck, BellOff, Workflow, ChevronRight, Loader2, X, BookOpen } from 'lucide-react';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import { Sparkline } from '@/components/charts/sparkline';
import type { StatusKind } from '@/types';

interface Alert {
  id: string; sev: string; kind: StatusKind; title: string; device: string;
  iface: string; rule: string; ack: boolean; suppressed: boolean;
  age: string; rc: string; children?: number;
}

interface SeverityCount { label: string; n: number; color: string }

interface AlertsData {
  alerts: Alert[];
  open: number;
  acked: number;
  suppressed: number;
  severityCounts: SeverityCount[];
  volumeChart: number[];
  rootCauseChain: string[];
}

// Runbook steps keyed by rule prefix
const RUNBOOKS: Record<string, { title: string; steps: string[] }> = {
  'BGP': {
    title: 'BGP Session Down',
    steps: [
      'Verify physical connectivity to BGP peer (ping reachable?).',
      'Check interface status: `show interfaces <iface>`.',
      'Review BGP neighbor state: `show bgp neighbors <peer-ip>`.',
      'Inspect BGP logs for NOTIFICATION messages or hold-timer expiry.',
      'Confirm BGP config matches peer (AS number, auth key, timers).',
      'If peer is up but session drops, check MD5 auth and MTU/path issues.',
      'Escalate to carrier if upstream AS and layer-1 is confirmed clean.',
    ],
  },
  'ICMP': {
    title: 'ICMP / Device Reachability Loss',
    steps: [
      'Ping device management IP from multiple collectors.',
      'Check OOB/management interface separately (separate failure domain).',
      'Verify SNMP poller can still reach device.',
      'Look for upstream link failures or route blackholes.',
      'Confirm CPU / memory on device is not causing SNMP agent hang.',
      'Check firewall ACLs blocking ICMP from monitoring source.',
    ],
  },
  'CPU': {
    title: 'CPU Sustained High',
    steps: [
      'Run `show processes cpu sorted` to identify top consumers.',
      'Check for routing protocol churn (BGP, OSPF reconvergence).',
      'Look for traffic spikes or DDoS conditions on interfaces.',
      'Check if scheduled tasks (backup, SNMP polling) are overlapping.',
      'Consider redistributing load if device is oversubscribed.',
      'Open TAC case if CPU stays > 90% with no clear process cause.',
    ],
  },
  'MEM': {
    title: 'Memory Utilization High',
    steps: [
      'Run `show memory statistics` to identify consumers.',
      'Check for memory leaks in routing processes (CEF, BGP table).',
      'Review number of BGP/OSPF prefixes and compare to baseline.',
      'Look for large ACLs or NAT table growth.',
      'Schedule maintenance window to clear and reload if above 95%.',
    ],
  },
  'VPN': {
    title: 'VPN Tunnel Down',
    steps: [
      'Verify IKE Phase 1 is established (`show crypto isakmp sa`).',
      'Check IPsec Phase 2 (`show crypto ipsec sa`).',
      'Confirm peer IP address and pre-shared key are correct.',
      'Check for ISP NAT / firewall blocking UDP 500 and 4500.',
      'Review DPD (Dead Peer Detection) settings.',
      'Re-initiate tunnel by clearing SAs: `clear crypto isakmp`.',
    ],
  },
  'IF': {
    title: 'Interface Issue',
    steps: [
      'Check interface counters for errors, CRC, runts, giants.',
      'Inspect SFP/cable — check DOM readings if available.',
      'Verify duplex and speed negotiation is correct.',
      'Check for spanning-tree port state changes.',
      'Bounce interface carefully if traffic impact is acceptable.',
      'Replace SFP/cable if physical errors persist.',
    ],
  },
  'OSPF': {
    title: 'OSPF Adjacency Flap',
    steps: [
      'Check `show ip ospf neighbor` for state history.',
      'Verify hello/dead timers match on both sides.',
      'Look for MTU mismatch (`ip ospf mtu-ignore` may mask it).',
      'Inspect interface for packet loss that breaks hello exchange.',
      'Check authentication (MD5 key mismatch causes silent drops).',
      'Review area and network type configuration on both peers.',
    ],
  },
  'DOM': {
    title: 'Optic DOM / Rx Power Low',
    steps: [
      'Read DOM values: `show interfaces <iface> transceiver detail`.',
      'Check Rx power against optic spec sheet minimum threshold.',
      'Inspect fiber connectors for dirt / contamination.',
      'Clean connectors with appropriate fiber cleaning tool.',
      'Check patch panel for damaged or misrouted fiber.',
      'Replace SFP if cleaning does not restore Rx power.',
    ],
  },
  'NTP': {
    title: 'NTP Sync Failure',
    steps: [
      'Verify reachability to configured NTP servers.',
      'Check `show ntp status` and `show ntp associations`.',
      'Confirm firewall is not blocking UDP 123.',
      'Ensure at least one reachable stratum-2 server is configured.',
      'Check for clock drift — large offsets prevent fast re-sync.',
    ],
  },
  'STP': {
    title: 'STP Topology Change',
    steps: [
      'Identify the port generating TCNs: `show spanning-tree detail`.',
      'Check if TCN source is an access port (enable PortFast).',
      'Look for flapping uplinks causing repeated reconvergence.',
      'Verify BPDU Guard is enabled on edge ports.',
      'If TCNs are from a trunk port, investigate upstream instability.',
      'Consider enabling Rapid PVST+ if running legacy STP.',
    ],
  },
  'POE': {
    title: 'PoE Budget Overrun',
    steps: [
      'Run `show power inline` to see per-port consumption.',
      'Identify highest-draw devices (PTZ cameras, APs, phones).',
      'Check for recently added devices exceeding budget.',
      'Move high-draw devices to less-loaded ports or a second switch.',
      'Consider upgrading to a higher-wattage PoE supply.',
    ],
  },
  'CFG': {
    title: 'Configuration Drift',
    steps: [
      'Compare running config to golden baseline in config management.',
      'Identify changed sections (ACL, routing, interface config).',
      'Determine if change was authorized via change management system.',
      'Roll back unauthorized changes using `configure replace`.',
      'Update baseline if change was intentional and approved.',
    ],
  },
  'MW': {
    title: 'Maintenance Window',
    steps: [
      'Confirm maintenance window is scheduled in ITSM system.',
      'Notify NOC team of affected devices and expected downtime.',
      'Suppress related child alarms for the duration.',
      'Monitor for unexpected alerts outside the scope of maintenance.',
      'Clear maintenance window flag when work is complete.',
    ],
  },
  DEFAULT: {
    title: 'General Alert Runbook',
    steps: [
      'Review alert details and check device status in CMDB.',
      'Correlate with other alerts from the same device or site.',
      'Check recent change records for the affected device.',
      'Collect relevant `show` command output for analysis.',
      'Escalate to on-call engineer if unresolved after 15 minutes.',
    ],
  },
};

function getRunbook(rule: string) {
  const prefix = rule.split('::')[0].toUpperCase();
  return RUNBOOKS[prefix] ?? RUNBOOKS.DEFAULT;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function patchAlert(id: string, action: 'acknowledge' | 'suppress') {
  await fetch(`${API}/api/alerts/${encodeURIComponent(id)}/${action}`, {
    method: 'PATCH',
    credentials: 'include',
  });
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);
  const [runbookAlert, setRunbookAlert] = useState<Alert | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/alerts`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { setData(d); setSelected(new Set()); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleAlerts = data
    ? (activeFilter ? data.alerts.filter((a) => a.sev === activeFilter) : data.alerts)
    : [];

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(selected.size === visibleAlerts.length
      ? new Set()
      : new Set(visibleAlerts.map((a) => a.id)));

  const handleAction = async (action: 'acknowledge' | 'suppress') => {
    if (!selected.size) return;
    setActing(true);
    await Promise.all([...selected].map((id) => patchAlert(id, action)));
    setActing(false);
    load();
  };

  const openRunbook = () => {
    if (selected.size !== 1) return;
    const id = [...selected][0];
    const alert = data?.alerts.find((a) => a.id === id) ?? null;
    setRunbookAlert(alert);
  };

  const subtitle = data
    ? `${data.open} open · ${data.acked} acknowledged · ${data.suppressed} suppressed · root-cause correlation engine: ACTIVE`
    : 'Loading…';

  return (
    <>
      <TopBar title="Alerts" />
      <PageHeader
        title="Alerts"
        subtitle={subtitle}
        actions={
          <>
            <button
              disabled={!selected.size || acting}
              onClick={() => handleAction('acknowledge')}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-panel px-3 text-xs disabled:opacity-40 hover:bg-elevated disabled:cursor-not-allowed"
            >
              {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Acknowledge{selected.size > 0 && ` (${selected.size})`}
            </button>
            <button
              disabled={!selected.size || acting}
              onClick={() => handleAction('suppress')}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-panel px-3 text-xs disabled:opacity-40 hover:bg-elevated disabled:cursor-not-allowed"
            >
              <BellOff className="h-3.5 w-3.5" />
              Suppress{selected.size > 0 && ` (${selected.size})`}
            </button>
            <button
              disabled={selected.size !== 1}
              onClick={openRunbook}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Workflow className="h-3.5 w-3.5" /> Open runbook
            </button>
          </>
        }
      />

      <main className="flex-1 px-5 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading alerts…
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
              {(data?.severityCounts ?? []).map((v) => (
                <div
                  key={v.label}
                  onClick={() => setActiveFilter((f) => f === v.label ? null : v.label)}
                  className={`panel flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-elevated select-none
                    ${activeFilter === v.label ? 'ring-1 ring-primary bg-elevated' : ''}`}
                >
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{v.label}</span>
                  <span className={`font-mono text-lg ${v.color}`}>{v.n}</span>
                </div>
              ))}
            </div>

            {activeFilter && (
              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{activeFilter}</span> alerts
                <button onClick={() => setActiveFilter(null)} className="ml-1 text-primary hover:underline">
                  Clear filter
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Panel className="xl:col-span-2" title="Open Alerts" subtitle="Auto-correlated · grouped by root-cause">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-2 py-2">
                          <input
                            type="checkbox"
                            className="rounded border-border"
                            checked={visibleAlerts.length > 0 && selected.size === visibleAlerts.length}
                            onChange={toggleAll}
                          />
                        </th>
                        {['Sev', 'ID', 'Title', 'Device', 'Rule', 'Age', 'RC', ''].map((h) => (
                          <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visibleAlerts.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-2 py-8 text-center text-muted-foreground">
                            No {activeFilter ?? ''} alerts
                          </td>
                        </tr>
                      ) : visibleAlerts.map((a) => (
                        <tr
                          key={a.id}
                          onClick={() => toggleRow(a.id)}
                          className={`cursor-pointer transition-colors hover:bg-elevated/40
                            ${selected.has(a.id) ? 'bg-primary/8 ring-1 ring-inset ring-primary/20' : ''}
                            ${a.suppressed ? 'opacity-50' : ''}
                            ${!a.suppressed && a.rc === 'ROOT' ? 'bg-critical/5' : ''}`}
                        >
                          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded border-border"
                              checked={selected.has(a.id)}
                              onChange={() => toggleRow(a.id)}
                            />
                          </td>
                          <td className="px-2 py-2"><StatusPill kind={a.kind}>{a.sev}</StatusPill></td>
                          <td className="px-2 py-2 font-mono text-muted-foreground">{a.id}</td>
                          <td className="px-2 py-2">
                            {a.title}
                            {a.ack && <span className="ml-2 chip">ACK</span>}
                            {a.suppressed && <span className="ml-1 chip text-muted-foreground border-muted-foreground/30">SUPP</span>}
                          </td>
                          <td className="px-2 py-2 font-mono text-foreground">
                            {a.device}<span className="text-muted-foreground"> · {a.iface}</span>
                          </td>
                          <td className="px-2 py-2 font-mono text-muted-foreground">{a.rule}</td>
                          <td className="px-2 py-2 font-mono text-muted-foreground">{a.age}</td>
                          <td className="px-2 py-2">
                            {a.rc === 'ROOT' ? (
                              <span className="chip text-critical border-critical/40">ROOT · {a.children} children</span>
                            ) : a.rc === 'CHILD' ? (
                              <span className="chip">child</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <div className="space-y-4">
                <Panel title="Root Cause" subtitle="ALR-90213 · confidence 96%">
                  <div className="rounded-md border border-critical/30 bg-critical/10 p-3">
                    <div className="flex items-center gap-2 text-critical">
                      <ShieldAlert className="h-4 w-4" />
                      <span className="text-sm font-semibold">edge-rtr-nyc-01 unreachable</span>
                    </div>
                    <p className="mt-1 text-[11px] text-foreground/80">
                      Upstream BGP session loss has cascaded into 5 dependent alarms.
                      Suppressing children is recommended until root condition clears.
                    </p>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-[11px]">
                    {(data?.rootCauseChain ?? []).map((x) => (
                      <li key={x} className="flex items-center gap-2">
                        <span className="status-dot text-critical" /> {x}
                      </li>
                    ))}
                  </ul>
                </Panel>

                <Panel title="Alert Volume · 24h" subtitle="3,219 events · 184 deduplicated">
                  {data?.volumeChart && (
                    <Sparkline data={data.volumeChart} color="var(--color-critical)" height={120} />
                  )}
                </Panel>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Runbook drawer */}
      {runbookAlert && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRunbookAlert(null)} />
          <aside className="relative z-10 flex w-full max-w-md flex-col overflow-y-auto bg-background shadow-2xl border-l border-border">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Runbook</span>
              </div>
              <button onClick={() => setRunbookAlert(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 px-5 py-4 space-y-4">
              <div className="rounded-md border border-border bg-elevated/40 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <StatusPill kind={runbookAlert.kind}>{runbookAlert.sev}</StatusPill>
                  <span className="font-mono text-xs text-muted-foreground">{runbookAlert.id}</span>
                </div>
                <p className="text-sm font-medium">{runbookAlert.title}</p>
                <p className="text-xs text-muted-foreground">
                  {runbookAlert.device} · {runbookAlert.iface} · Rule: <span className="font-mono">{runbookAlert.rule}</span>
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">{getRunbook(runbookAlert.rule).title}</h3>
                <ol className="space-y-2.5">
                  {getRunbook(runbookAlert.rule).steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-[12px] leading-relaxed">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span className="text-foreground/85">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-md border border-border bg-panel/60 p-3 text-[11px] text-muted-foreground space-y-1">
                <p className="font-medium text-foreground/80">Quick actions</p>
                <p>After resolving: acknowledge this alert using the toolbar, then monitor for re-fire within 5 minutes.</p>
                <p>If escalating: attach this alert ID <span className="font-mono">{runbookAlert.id}</span> to the incident ticket.</p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
