'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Filter, MoreHorizontal, Server, Router, Wifi, Shield, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import { Sparkline } from '@/components/charts/sparkline';
import { AddDeviceDialog } from '@/components/devices/add-device-dialog';
import type { StatusKind } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const ICON_MAP: Record<string, LucideIcon> = {
  server: Server, router: Router, wifi: Wifi, shield: Shield,
};

interface DeviceRow {
  id: number; name: string; ip: string; vendor: string; model: string; role: string;
  site: string; status: StatusKind; cpu: number; mem: number; up: string;
  icon: string; trend: number[];
}

interface VendorCount { label: string; n: number }
interface DevicesData { devices: DeviceRow[]; vendorCounts: VendorCount[] }

interface AssetRow {
  sn: string; host: string; model: string; vendor: string;
  site: string; rack: string; os: string; purchased: string; warranty: string; eos: string;
}

type DeviceTab = 'All Devices' | 'Wireless' | 'Inventory';

function UtilBar({ v }: { v: number }) {
  const tone = v > 85 ? 'var(--color-critical)' : v > 70 ? 'var(--color-warning)' : 'var(--color-primary)';
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 text-right">{v}%</span>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-elevated">
        <div className="h-full" style={{ width: `${v}%`, background: tone }} />
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const [tab, setTab] = useState<DeviceTab>('All Devices');
  const [devicesData, setDevicesData] = useState<DevicesData | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [inventoryAssets, setInventoryAssets] = useState<AssetRow[] | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/devices`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setDevicesData)
      .finally(() => setDevicesLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'Inventory' && !inventoryLoaded) {
      setInventoryLoading(true);
      fetch(`${API}/api/inventory`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => { setInventoryAssets(d.assets ?? []); setInventoryLoaded(true); })
        .finally(() => setInventoryLoading(false));
    }
  }, [tab, inventoryLoaded]);

  const allDevices = devicesData?.devices ?? [];
  const wirelessDevices = allDevices.filter((d) =>
    d.role === 'wlc' || d.role === 'wireless' || d.icon === 'wifi'
  );
  const visibleDevices = tab === 'Wireless' ? wirelessDevices : allDevices;

  const TABS: DeviceTab[] = ['All Devices', 'Wireless', 'Inventory'];

  return (
    <>
      <TopBar title="Devices" />
      <PageHeader
        title="Devices"
        subtitle="1,314 monitored · 1,284 up · 23 warning · 7 down"
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input className="h-8 w-64 rounded-md border border-input bg-panel pl-7 pr-2 text-xs" placeholder="Filter name, IP, MAC, vendor…" />
            </div>
            <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-panel px-3 text-xs">
              <Filter className="h-3.5 w-3.5" /> Saved views
            </button>
          </>
        }
      />

      {/* Tab bar */}
      <div className="border-b border-border bg-background">
        <div className="flex gap-0 px-5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2.5 text-[12px] font-medium transition-colors ${
                tab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
              }`}
            >
              {t}
              {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-primary" />}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 px-5 py-5">
        {devicesLoading && tab !== 'Inventory' ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading devices…
          </div>
        ) : tab === 'Inventory' ? (
          inventoryLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading inventory…
            </div>
          ) : (
            <Panel title="Asset Register" subtitle="Lifecycle and warranty tracking">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b border-border">
                      {['Serial', 'Hostname', 'Model', 'Vendor', 'Site', 'Rack', 'OS', 'Purchased', 'Warranty', 'EoS'].map((h) => (
                        <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(inventoryAssets ?? []).map((r) => (
                      <tr key={r.sn} className="hover:bg-elevated/40">
                        <td className="px-2 py-2 font-mono">{r.sn}</td>
                        <td className="px-2 py-2 font-mono">{r.host}</td>
                        <td className="px-2 py-2">{r.model}</td>
                        <td className="px-2 py-2 text-muted-foreground">{r.vendor}</td>
                        <td className="px-2 py-2">{r.site}</td>
                        <td className="px-2 py-2 font-mono text-muted-foreground">{r.rack}</td>
                        <td className="px-2 py-2 font-mono">{r.os}</td>
                        <td className="px-2 py-2 font-mono text-muted-foreground">{r.purchased}</td>
                        <td className="px-2 py-2 font-mono text-muted-foreground">{r.warranty}</td>
                        <td className="px-2 py-2 font-mono text-muted-foreground">{r.eos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
              {(devicesData?.vendorCounts ?? []).map((v) => (
                <div key={v.label} className="panel flex items-center justify-between p-3">
                  <span className="text-xs text-muted-foreground">{v.label}</span>
                  <span className="font-mono text-base">{v.n}</span>
                </div>
              ))}
            </div>

            <Panel
              title={tab === 'Wireless' ? 'Wireless Controllers & APs' : 'Device Inventory'}
              subtitle="Click a row to drill into device detail"
              actions={<AddDeviceDialog />}
            >
              {tab === 'Wireless' && wirelessDevices.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No wireless controllers or APs found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b border-border">
                        {['Device', 'IP', 'Vendor / Model', 'Role', 'Site', 'Status', 'CPU', 'Mem', 'Uptime', 'Trend', ''].map((h) => (
                          <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visibleDevices.map((r) => {
                        const Icon = ICON_MAP[r.icon] ?? Server;
                        return (
                          <tr key={r.id} className="hover:bg-elevated/40 cursor-pointer">
                            <td className="px-2 py-2">
                              <Link href={`/devices/${r.id}`} className="flex items-center gap-2 hover:underline underline-offset-2">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                                <span className="font-mono text-foreground">{r.name}</span>
                              </Link>
                            </td>
                            <td className="px-2 py-2 font-mono text-muted-foreground">{r.ip}</td>
                            <td className="px-2 py-2">
                              <div className="text-foreground">{r.vendor}</div>
                              <div className="text-[10px] text-muted-foreground">{r.model}</div>
                            </td>
                            <td className="px-2 py-2"><span className="chip">{r.role}</span></td>
                            <td className="px-2 py-2 text-muted-foreground">{r.site}</td>
                            <td className="px-2 py-2"><StatusPill kind={r.status}>{r.status}</StatusPill></td>
                            <td className="px-2 py-2 font-mono"><UtilBar v={r.cpu} /></td>
                            <td className="px-2 py-2 font-mono"><UtilBar v={r.mem} /></td>
                            <td className="px-2 py-2 font-mono text-muted-foreground">{r.up}</td>
                            <td className="px-2 py-2 w-32">
                              <Sparkline
                                data={r.trend}
                                height={22}
                                fill={false}
                                color={r.status === 'down' ? 'var(--color-critical)' : 'var(--color-primary)'}
                              />
                            </td>
                            <td className="px-2 py-2 text-right">
                              <button className="grid h-6 w-6 place-items-center rounded hover:bg-elevated">
                                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}
      </main>
    </>
  );
}
