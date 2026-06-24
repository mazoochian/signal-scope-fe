'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';

interface AssetRow {
  sn: string; host: string; model: string; vendor: string;
  site: string; rack: string; os: string;
  purchased: string; warranty: string; eos: string;
}

interface SummaryItem { label: string; value: string; tone: string }

interface InventoryData { assets: AssetRow[]; summary: SummaryItem[] }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function matchesFilter(a: AssetRow, label: string): boolean {
  const now = new Date();
  const eosDate  = a.eos      ? new Date(a.eos)      : null;
  const warDate  = a.warranty ? new Date(a.warranty)  : null;
  const key = label.toLowerCase();

  if (key.includes('total')) return true;

  if (key === 'eol' || key === 'end of life') {
    return eosDate ? eosDate < now : false;
  }
  if (key === 'eol < 12m') {
    const in12m = new Date(now.getFullYear(), now.getMonth() + 12, now.getDate());
    return eosDate ? (eosDate > now && eosDate <= in12m) : false;
  }
  if (key.startsWith('warranty')) {
    return warDate ? warDate < now : false;
  }
  return true;
}

export default function InventoryPage() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/inventory`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const isTotal = (label: string) => label.toLowerCase().includes('total');

  function handleChipClick(label: string) {
    if (isTotal(label)) { setActiveFilter(null); return; }
    setActiveFilter((f) => f === label ? null : label);
  }

  const filteredAssets = data
    ? (activeFilter ? data.assets.filter((a) => matchesFilter(a, activeFilter)) : data.assets)
    : [];

  return (
    <>
      <TopBar title="Inventory" />
      <PageHeader
        title="Inventory"
        subtitle="1,314 assets · 184 racks · 6 sites · lifecycle + warranty tracking"
      />

      <main className="flex-1 px-5 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading inventory…
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {(data?.summary ?? []).map((s) => (
                <div
                  key={s.label}
                  onClick={() => handleChipClick(s.label)}
                  className={`panel flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-elevated select-none
                    ${!isTotal(s.label) && activeFilter === s.label ? 'ring-1 ring-primary bg-elevated' : ''}`}
                >
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <span className={`font-mono text-base text-${s.tone}`}>{s.value}</span>
                </div>
              ))}
            </div>

            {activeFilter && (
              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                Filtered by <span className="font-medium text-foreground">{activeFilter}</span>
                <button onClick={() => setActiveFilter(null)} className="ml-1 text-primary hover:underline">
                  Clear
                </button>
              </div>
            )}

            <Panel title="Asset register">
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
                    {filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-2 py-8 text-center text-muted-foreground">
                          No assets match this filter.
                        </td>
                      </tr>
                    ) : filteredAssets.map((r) => (
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
          </>
        )}
      </main>
    </>
  );
}
