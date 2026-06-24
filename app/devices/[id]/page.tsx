'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Server, Router, Wifi, Shield, Activity,
  Cpu, HardDrive, Globe, Gauge, AlertTriangle, CheckCircle, XCircle,
  ExternalLink
} from 'lucide-react';
import { TopBar } from '@/components/layout/top-bar';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import { Sparkline } from '@/components/charts/sparkline';
import { API_URL } from '@/lib/api';
import type { StatusKind } from '@/types/index';

const ICON_MAP: Record<string, React.ElementType> = {
  server: Server, router: Router, wifi: Wifi, shield: Shield,
};

interface DeviceDetail {
  id: number; name: string; ip: string; vendor: string; model: string;
  role: string; site: string; status: StatusKind; cpu: number; mem: number;
  up: string; icon: string; trend: number[];
}

interface Interface {
  id: number; name: string; description: string; speed: string;
  vlan: string | null; status: string; duplex: string;
}

interface DeviceHistory {
  id: string; role: string; status: string; site: string;
  cpu: number[]; mem: number[]; ingressGbps: number[]; egressGbps: number[];
  latencyMs: number[]; timestamps: number[];
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function MetricCard({ label, value, unit, icon: Icon, color }: {
  label: string; value: number; unit: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="panel flex flex-col gap-1 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`text-2xl font-mono font-semibold ${color}`}>
        {value.toFixed(1)}<span className="text-sm text-muted-foreground ml-1">{unit}</span>
      </div>
    </div>
  );
}

function IfaceStatusIcon({ status }: { status: string }) {
  if (status === 'up') return <CheckCircle className="h-3.5 w-3.5 text-success" />;
  if (status === 'down') return <XCircle className="h-3.5 w-3.5 text-critical" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-warning" />;
}

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [ifaces, setIfaces] = useState<Interface[]>([]);
  const [history, setHistory] = useState<DeviceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Device info from devices list
      const devList = await apiFetch<{ devices: DeviceDetail[] }>('/devices');
      const dev = devList.devices.find((d) => d.id === Number(id));
      if (!dev) throw new Error('Device not found');
      setDevice(dev);

      // Interfaces
      const ifaceData = await apiFetch<{ interfaces: Interface[] }>(`/interfaces?deviceId=${id}`).catch(() => ({ interfaces: [] }));
      setIfaces(ifaceData.interfaces ?? []);

      // Simulation history (matched by device name)
      const hist = await apiFetch<DeviceHistory>(`/simulation/device/${dev.name}`).catch(() => null);
      setHistory(hist);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>{error ?? 'Device not found'}</p>
        <Link href="/devices" className="text-primary hover:underline text-sm">← Back to devices</Link>
      </div>
    );
  }

  const Icon = ICON_MAP[device.icon] ?? Server;
  const latest = history
    ? {
        cpu: history.cpu[history.cpu.length - 1] ?? 0,
        mem: history.mem[history.mem.length - 1] ?? 0,
        ingress: history.ingressGbps[history.ingressGbps.length - 1] ?? 0,
        egress: history.egressGbps[history.egressGbps.length - 1] ?? 0,
        latency: history.latencyMs[history.latencyMs.length - 1] ?? 0,
      }
    : { cpu: device.cpu, mem: device.mem, ingress: 0, egress: 0, latency: 0 };

  const cpuColor = latest.cpu > 85 ? 'text-critical' : latest.cpu > 70 ? 'text-warning' : 'text-success';
  const memColor = latest.mem > 85 ? 'text-critical' : latest.mem > 70 ? 'text-warning' : 'text-success';

  return (
    <>
      <TopBar title={device.name} />

      <main className="flex-1 px-5 py-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Link href="/devices" className="mt-0.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex flex-1 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/20">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-lg font-semibold">{device.name}</h1>
                <StatusPill kind={device.status}>{device.status}</StatusPill>
              </div>
              <div className="text-xs text-muted-foreground">
                {device.vendor} {device.model} · {device.role} · {device.site} · <span className="font-mono">{device.ip}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/configuration?device=${device.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-panel px-3 text-xs hover:bg-elevated"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Configuration
            </Link>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard label="CPU" value={latest.cpu} unit="%" icon={Cpu} color={cpuColor} />
          <MetricCard label="Memory" value={latest.mem} unit="%" icon={HardDrive} color={memColor} />
          <MetricCard label="Ingress" value={latest.ingress} unit="Gbps" icon={Globe} color="text-primary" />
          <MetricCard label="Egress" value={latest.egress} unit="Gbps" icon={Globe} color="text-primary" />
          <MetricCard label="Latency" value={latest.latency} unit="ms" icon={Gauge} color="text-foreground" />
        </div>

        {/* Charts */}
        {history && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Panel title="CPU & Memory" subtitle="Last 10 minutes (2s intervals)">
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>CPU</span><span className={cpuColor}>{latest.cpu.toFixed(1)}%</span>
                  </div>
                  <Sparkline
                    data={history.cpu.slice(-80)}
                    height={40}
                    fill
                    color={latest.cpu > 85 ? 'var(--color-critical)' : latest.cpu > 70 ? 'var(--color-warning)' : 'var(--color-primary)'}
                  />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>Memory</span><span className={memColor}>{latest.mem.toFixed(1)}%</span>
                  </div>
                  <Sparkline
                    data={history.mem.slice(-80)}
                    height={40}
                    fill
                    color={latest.mem > 85 ? 'var(--color-critical)' : 'var(--color-success)'}
                  />
                </div>
              </div>
            </Panel>

            <Panel title="Traffic" subtitle="Ingress vs Egress (Gbps)">
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>Ingress</span><span className="text-primary">{latest.ingress.toFixed(2)} Gbps</span>
                  </div>
                  <Sparkline data={history.ingressGbps.slice(-80)} height={40} fill color="var(--color-primary)" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>Egress</span><span className="text-success">{latest.egress.toFixed(2)} Gbps</span>
                  </div>
                  <Sparkline data={history.egressGbps.slice(-80)} height={40} fill color="var(--color-success)" />
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* Interfaces */}
        {ifaces.length > 0 && (
          <Panel title="Interfaces" subtitle={`${ifaces.length} configured · ${ifaces.filter(i => i.status === 'up').length} up`}>
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                <tr>
                  {['Status', 'Name', 'Description', 'Speed', 'Duplex', 'VLAN'].map((h) => (
                    <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ifaces.map((iface) => (
                  <tr key={iface.id} className="hover:bg-elevated/40">
                    <td className="px-2 py-2">
                      <IfaceStatusIcon status={iface.status} />
                    </td>
                    <td className="px-2 py-2 font-mono">{iface.name}</td>
                    <td className="px-2 py-2 text-muted-foreground">{iface.description || '—'}</td>
                    <td className="px-2 py-2 font-mono">{iface.speed || '—'}</td>
                    <td className="px-2 py-2 text-muted-foreground">{iface.duplex}</td>
                    <td className="px-2 py-2 font-mono">{iface.vlan || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </main>
    </>
  );
}
