'use client';

import { useState, useEffect } from 'react';
import { History, Download, Loader2, ChevronDown, ChevronUp, RefreshCw, Server } from 'lucide-react';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import { API_URL } from '@/lib/api';
import Link from 'next/link';

interface DeviceSummary {
  deviceId: number;
  deviceName: string;
  vendor: string;
  model: string;
  status: string;
  latestVersion: number | null;
  lastSnapshotAt: string | null;
  hasDrift: boolean;
}

interface ConfigSnapshot {
  deviceId: number;
  version: number;
  configText: string;
  committedBy: string | null;
  committedAt: string;
  notes: string | null;
}

interface VersionEntry {
  id: number;
  version: number;
  committedBy: string | null;
  committedAt: string;
  notes: string | null;
}

async function apiCall<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
}

export default function ConfigurationPage() {
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [selected, setSelected] = useState<DeviceSummary | null>(null);
  const [config, setConfig] = useState<ConfigSnapshot | null>(null);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [backingUpAll, setBackingUpAll] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  async function loadDevices(): Promise<DeviceSummary[]> {
    setLoadingDevices(true);
    try {
      const list = await apiCall<DeviceSummary[]>('/configuration/devices');
      setDevices(list);
      return list;
    } finally {
      setLoadingDevices(false);
    }
  }

  async function selectDevice(dev: DeviceSummary) {
    setSelected(dev);
    setShowHistory(false);
    setLoadingConfig(true);
    try {
      const [cfg, hist] = await Promise.all([
        apiCall<ConfigSnapshot>(`/configuration/devices/${dev.deviceId}/config`),
        apiCall<VersionEntry[]>(`/configuration/devices/${dev.deviceId}/history`),
      ]);
      setConfig(cfg);
      setVersions(hist);
    } finally {
      setLoadingConfig(false);
    }
  }

  useEffect(() => {
    loadDevices().then((list) => {
      if (!hasAutoSelected && list.length > 0) {
        setHasAutoSelected(true);
        selectDevice(list[0]);
      }
    });
  }, []);

  async function loadVersion(version: number) {
    if (!selected) return;
    setLoadingConfig(true);
    try {
      const cfg = await apiCall<ConfigSnapshot>(`/configuration/devices/${selected.deviceId}/config/${version}`);
      setConfig(cfg);
      setShowHistory(false);
    } finally {
      setLoadingConfig(false);
    }
  }

  async function takeSnapshot() {
    if (!selected) return;
    setSnapshotting(true);
    try {
      const snap = await apiCall<ConfigSnapshot>(
        `/configuration/devices/${selected.deviceId}/snapshot`,
        'POST',
        { committedBy: 'admin', notes: 'Manual snapshot' },
      );
      setConfig(snap);
      const hist = await apiCall<VersionEntry[]>(`/configuration/devices/${selected.deviceId}/history`);
      setVersions(hist);
      loadDevices();
    } finally {
      setSnapshotting(false);
    }
  }

  async function backupAll() {
    setBackingUpAll(true);
    try {
      await apiCall('/configuration/snapshot-all', 'POST');
      const list = await loadDevices();
      if (selected) {
        const refreshed = list.find((d) => d.deviceId === selected.deviceId);
        if (refreshed) selectDevice(refreshed);
      }
    } finally {
      setBackingUpAll(false);
    }
  }

  const driftCount = devices.filter((d) => d.hasDrift).length;
  const totalVersions = devices.reduce((s, d) => s + (d.latestVersion ?? 0), 0);

  return (
    <>
      <TopBar title="Configuration Management" />
      <PageHeader
        title="Configuration Management"
        subtitle={`${totalVersions} backups stored · ${driftCount} drift alerts · SSH / NETCONF / RESTCONF / gNMI`}
        actions={
          <>
            <button
              onClick={takeSnapshot}
              disabled={!selected || snapshotting}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-panel px-3 text-xs disabled:opacity-40"
            >
              {snapshotting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Snapshot
            </button>
            <button
              onClick={backupAll}
              disabled={backingUpAll}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              {backingUpAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Backup all
            </button>
          </>
        }
      />

      <main className="flex-1 px-5 py-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
          {/* Device list */}
          <Panel title="Devices · backup status">
            {loadingDevices ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {devices.map((d) => (
                  <li key={d.deviceId}>
                    <button
                      onClick={() => selectDevice(d)}
                      className={`w-full text-left flex items-center justify-between rounded border p-2 transition-colors ${
                        selected?.deviceId === d.deviceId
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-border bg-elevated/40 hover:bg-elevated'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono truncate">{d.deviceName}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {d.vendor} · {d.model}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          v{d.latestVersion ?? '–'} · {d.lastSnapshotAt ? timeAgo(d.lastSnapshotAt) : 'never'}
                        </div>
                      </div>
                      <div className="ml-2 shrink-0">
                        {d.hasDrift ? (
                          <span className="chip text-warning border-warning/40">drift</span>
                        ) : (
                          <StatusPill kind={d.status as any}>{d.status === 'up' ? 'in sync' : d.status}</StatusPill>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Config viewer */}
          <div className="flex flex-col gap-3">
            {selected ? (
              <Panel
                title={`Running config · ${selected.deviceName}`}
                subtitle={
                  config
                    ? `v${config.version} · ${config.committedBy ?? 'system'} · ${new Date(config.committedAt).toLocaleString()}`
                    : 'Loading…'
                }
                actions={
                  <div className="flex items-center gap-2">
                    {versions.length > 0 && (
                      <button
                        onClick={() => setShowHistory((v) => !v)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 text-[11px] hover:bg-elevated"
                      >
                        <History className="h-3 w-3" />
                        {showHistory ? 'Hide' : `History (${versions.length})`}
                        {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    )}
                    <Link
                      href={`/devices/${selected.deviceId}`}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 text-[11px] hover:bg-elevated"
                    >
                      <Server className="h-3 w-3" /> Device detail
                    </Link>
                  </div>
                }
              >
                {showHistory && (
                  <div className="mb-3 rounded-md border border-border bg-background p-2 overflow-auto">
                    <table className="w-full text-[11px]">
                      <thead className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                        <tr>
                          <th className="pb-1 pr-3 text-left font-medium">Version</th>
                          <th className="pb-1 pr-3 text-left font-medium">Date</th>
                          <th className="pb-1 pr-3 text-left font-medium">By</th>
                          <th className="pb-1 text-left font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {versions.map((v) => (
                          <tr key={v.id}>
                            <td className="py-1 pr-3">
                              <button
                                onClick={() => loadVersion(v.version)}
                                className="font-mono text-primary hover:underline"
                              >
                                v{v.version}
                              </button>
                            </td>
                            <td className="py-1 pr-3 text-muted-foreground">{new Date(v.committedAt).toLocaleString()}</td>
                            <td className="py-1 pr-3 text-muted-foreground">{v.committedBy ?? '—'}</td>
                            <td className="py-1 text-muted-foreground">{v.notes ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {loadingConfig ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading config…
                  </div>
                ) : config ? (
                  <div className="rounded-md border border-border bg-background font-mono text-[11.5px] leading-relaxed overflow-auto max-h-[60vh]">
                    {config.configText.split('\n').map((line, i) => {
                      const trimmed = line.trim();
                      const isComment = trimmed.startsWith('!') || trimmed.startsWith('#') || trimmed.startsWith('##');
                      const isKeyword = /^(interface\s|router\s|hostname\s|ip\s|set\s|configure|system\s|protocols|port\s|version\s|crypto|snmp)/.test(trimmed);
                      return (
                        <div
                          key={i}
                          className={`flex gap-3 px-3 py-0.5 hover:bg-elevated/40 ${
                            isComment
                              ? 'text-muted-foreground/50'
                              : isKeyword
                              ? 'text-primary'
                              : 'text-foreground'
                          }`}
                        >
                          <span className="w-8 select-none shrink-0 text-right text-muted-foreground/30 text-[10px]">
                            {i + 1}
                          </span>
                          <span className="flex-1 whitespace-pre">{line}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </Panel>
            ) : (
              !loadingDevices && (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border py-20 text-sm text-muted-foreground">
                  Select a device to view its running configuration
                </div>
              )
            )}
          </div>
        </div>
      </main>
    </>
  );
}
