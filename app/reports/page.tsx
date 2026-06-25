'use client';

import { useState, useEffect } from 'react';
import {
  FileBarChart2, Calendar, Mail, Download, Eye, Pencil,
  X, Plus, Trash2, Loader2, FileSpreadsheet, Send,
} from 'lucide-react';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { API_URL } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportDef {
  id: string;
  title: string;
  description: string;
  category: string;
  defaultFrequency: string;
  defaultRange: string;
  supportsExcel: boolean;
}

interface ReportConfig {
  frequency: string;
  range: string;
  recipients: string[];
}

// ─── Report definitions ───────────────────────────────────────────────────────

const REPORT_DEFS: ReportDef[] = [
  {
    id: 'device-health',
    title: 'Device Health Summary',
    description: 'CPU, memory, status across all monitored devices',
    category: 'Operations',
    defaultFrequency: 'Daily',
    defaultRange: '24h',
    supportsExcel: true,
  },
  {
    id: 'interface-utilization',
    title: 'Interface Utilization',
    description: 'Bandwidth utilization across all interfaces',
    category: 'Capacity',
    defaultFrequency: 'Weekly',
    defaultRange: '7d',
    supportsExcel: true,
  },
  {
    id: 'alert-summary',
    title: 'Alert & Event Summary',
    description: 'Alert volume, severity breakdown, MTTR',
    category: 'Operations',
    defaultFrequency: 'Daily',
    defaultRange: '24h',
    supportsExcel: false,
  },
  {
    id: 'availability',
    title: 'Availability Report',
    description: 'Per-device and per-site availability percentages',
    category: 'SLA',
    defaultFrequency: 'Monthly',
    defaultRange: '30d',
    supportsExcel: true,
  },
];

const FREQUENCIES = ['None', 'Hourly', 'Daily', 'Weekly', 'Monthly'];
const RANGES = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days',   value: '7d' },
  { label: 'Last 30 days',  value: '30d' },
];

const CATEGORY_COLOR: Record<string, string> = {
  Operations: 'bg-primary/15 text-primary',
  Capacity:   'bg-warning/15 text-warning',
  SLA:        'bg-success/15 text-success',
};

// ─── PDF / Excel generation ───────────────────────────────────────────────────

async function downloadPDF(def: ReportDef, data: Record<string, unknown>, range: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? range;

  doc.setFontSize(18);
  doc.text(def.title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  Range: ${rangeLabel}`, 14, 26);
  doc.setTextColor(0);

  let y = 34;

  if (def.id === 'device-health') {
    const d = data as { summary: { total: number; up: number; warn: number; down: number }; topByCpu: { name: string; site: string; cpu: number; mem: number }[] };
    const { total, up, warn, down } = d.summary;
    autoTable(doc, {
      head: [['Total Devices', 'Up', 'Warning', 'Down']],
      body: [[total, up, warn, down]],
      startY: y, theme: 'grid', headStyles: { fillColor: [30, 41, 59] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(11);
    doc.text('Top Devices by CPU', 14, y);
    y += 4;
    autoTable(doc, {
      head: [['Device', 'Site', 'CPU %', 'Memory %']],
      body: d.topByCpu.map((r) => [r.name, r.site, r.cpu, r.mem]),
      startY: y, theme: 'striped',
    });
  } else if (def.id === 'interface-utilization') {
    const d = data as { interfaces: { name: string; device: string; avgIn: number; avgOut: number; peakIn: number; peakOut: number }[] };
    autoTable(doc, {
      head: [['Interface', 'Device', 'Avg In (Mbps)', 'Avg Out (Mbps)', 'Peak In', 'Peak Out']],
      body: d.interfaces.map((r) => [r.name, r.device, r.avgIn, r.avgOut, r.peakIn, r.peakOut]),
      startY: y, theme: 'striped', headStyles: { fillColor: [30, 41, 59] },
    });
  } else if (def.id === 'alert-summary') {
    const d = data as { summary: { total: number; critical: number; major: number; minor: number }; topDevices: { name: string; alertCount: number }[] };
    autoTable(doc, {
      head: [['Total', 'Critical', 'Major', 'Minor']],
      body: [[d.summary.total, d.summary.critical, d.summary.major, d.summary.minor]],
      startY: y, theme: 'grid', headStyles: { fillColor: [30, 41, 59] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    autoTable(doc, {
      head: [['Device', 'Alert Count']],
      body: d.topDevices.map((r) => [r.name, r.alertCount]),
      startY: y, theme: 'striped',
    });
  } else if (def.id === 'availability') {
    const d = data as { devices: { name: string; site: string; status: string; availability: number }[] };
    autoTable(doc, {
      head: [['Device', 'Site', 'Status', 'Availability %']],
      body: d.devices.map((r) => [r.name, r.site, r.status, r.availability + '%']),
      startY: y, theme: 'striped', headStyles: { fillColor: [30, 41, 59] },
    });
  }

  doc.save(`${def.id}-${Date.now()}.pdf`);
}

async function downloadExcel(def: ReportDef, data: Record<string, unknown>) {
  const XLSX = await import('xlsx');

  const wb = XLSX.utils.book_new();

  if (def.id === 'device-health') {
    const d = data as { summary: { total: number; up: number; warn: number; down: number }; topByCpu: { name: string; site: string; cpu: number; mem: number }[] };
    const summaryWs = XLSX.utils.aoa_to_sheet([
      ['Total Devices', 'Up', 'Warning', 'Down'],
      [d.summary.total, d.summary.up, d.summary.warn, d.summary.down],
    ]);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    const cpuWs = XLSX.utils.aoa_to_sheet([
      ['Device', 'Site', 'CPU %', 'Memory %'],
      ...d.topByCpu.map((r) => [r.name, r.site, r.cpu, r.mem]),
    ]);
    XLSX.utils.book_append_sheet(wb, cpuWs, 'Top CPU');
  } else if (def.id === 'interface-utilization') {
    const d = data as { interfaces: { name: string; device: string; avgIn: number; avgOut: number; peakIn: number; peakOut: number }[] };
    const ws = XLSX.utils.aoa_to_sheet([
      ['Interface', 'Device', 'Avg In (Mbps)', 'Avg Out (Mbps)', 'Peak In', 'Peak Out'],
      ...d.interfaces.map((r) => [r.name, r.device, r.avgIn, r.avgOut, r.peakIn, r.peakOut]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Interface Utilization');
  } else if (def.id === 'availability') {
    const d = data as { devices: { name: string; site: string; status: string; availability: number }[] };
    const ws = XLSX.utils.aoa_to_sheet([
      ['Device', 'Site', 'Status', 'Availability %'],
      ...d.devices.map((r) => [r.name, r.site, r.status, r.availability]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Availability');
  }

  XLSX.writeFile(wb, `${def.id}-${Date.now()}.xlsx`);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [reportConfigs, setReportConfigs] = useState<Record<string, ReportConfig>>(
    Object.fromEntries(
      REPORT_DEFS.map((r) => [r.id, { frequency: r.defaultFrequency, range: r.defaultRange, recipients: [] }])
    )
  );

  // View modal
  const [viewingDef, setViewingDef] = useState<ReportDef | null>(null);
  const [viewData, setViewData] = useState<Record<string, unknown> | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  // Send modal
  const [sendingDef, setSendingDef] = useState<ReportDef | null>(null);
  const [newRecipient, setNewRecipient] = useState('');
  const [telegramAvailable, setTelegramAvailable] = useState(false);
  const slackAvailable = true;

  // Edit modal
  const [editingDef, setEditingDef] = useState<ReportDef | null>(null);
  const [editForm, setEditForm] = useState<ReportConfig>({ frequency: '', range: '', recipients: [] });

  useEffect(() => {
    fetch(`${API_URL}/api/oidc/providers`, { credentials: 'include' })
      .then((r) => r.json())
      .then((providers: { provider_type?: string; enabled?: boolean }[]) => {
        setTelegramAvailable(providers.some((p) => p.provider_type === 'telegram' && p.enabled));
      })
      .catch(() => {});
  }, []);

  async function openView(def: ReportDef) {
    setViewingDef(def);
    setViewData(null);
    setViewError(null);
    setViewLoading(true);
    try {
      const range = reportConfigs[def.id]?.range ?? '7d';
      const res = await fetch(`${API_URL}/api/reports/data/${def.id}?range=${range}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setViewData(await res.json());
    } catch (e: unknown) {
      setViewError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setViewLoading(false);
    }
  }

  function openSend(def: ReportDef) {
    setSendingDef(def);
    setNewRecipient('');
  }

  function openEdit(def: ReportDef) {
    setEditingDef(def);
    setEditForm({ ...reportConfigs[def.id] });
  }

  function saveEdit() {
    if (!editingDef) return;
    setReportConfigs((prev) => ({ ...prev, [editingDef.id]: { ...editForm } }));
    setEditingDef(null);
  }

  function addRecipient(defId: string) {
    if (!newRecipient.trim()) return;
    setReportConfigs((prev) => ({
      ...prev,
      [defId]: { ...prev[defId], recipients: [...prev[defId].recipients, newRecipient.trim()] },
    }));
    setNewRecipient('');
  }

  function removeRecipient(defId: string, i: number) {
    setReportConfigs((prev) => ({
      ...prev,
      [defId]: { ...prev[defId], recipients: prev[defId].recipients.filter((_, idx) => idx !== i) },
    }));
  }

  function sendByEmail(def: ReportDef) {
    const cfg = reportConfigs[def.id];
    const emails = cfg.recipients.filter((r) => r.includes('@') && !r.startsWith('@'));
    if (!emails.length) { alert('Add at least one email recipient first.'); return; }
    const subject = encodeURIComponent(`${def.title} — SignalScope NMS`);
    const body = encodeURIComponent(
      `Please find attached the ${def.title}.\n\nGenerated: ${new Date().toLocaleString()}\nRange: ${RANGES.find((r) => r.value === cfg.range)?.label ?? cfg.range}\n\n— SignalScope NMS`
    );
    window.location.href = `mailto:${emails.join(',')}?subject=${subject}&body=${body}`;
  }

  const rangeLabel = (id: string) => RANGES.find((r) => r.value === reportConfigs[id]?.range)?.label ?? '7d';

  return (
    <>
      <TopBar title="Reports" />
      <PageHeader title="Reports" subtitle="Scheduled and on-demand reports · PDF · Excel · Email" />

      <main className="flex-1 px-5 py-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {REPORT_DEFS.map((def) => {
            const cfg = reportConfigs[def.id];
            return (
              <Panel key={def.id} title={def.title} subtitle={def.description}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLOR[def.category] ?? 'bg-muted/40 text-muted-foreground'}`}>
                    {def.category}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />{cfg.frequency}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    Today 06:00 · {rangeLabel(def.id)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => openView(def)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 text-[11px] hover:bg-elevated">
                    <Eye className="h-3 w-3" /> View
                  </button>
                  <button
                    onClick={async () => {
                      const range = cfg.range;
                      const res = await fetch(`${API_URL}/api/reports/data/${def.id}?range=${range}`, { credentials: 'include' });
                      const data = await res.json();
                      await downloadPDF(def, data, range);
                    }}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 text-[11px] hover:bg-elevated">
                    <Download className="h-3 w-3" /> PDF
                  </button>
                  {def.supportsExcel && (
                    <button
                      onClick={async () => {
                        const res = await fetch(`${API_URL}/api/reports/data/${def.id}?range=${cfg.range}`, { credentials: 'include' });
                        const data = await res.json();
                        await downloadExcel(def, data);
                      }}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 text-[11px] hover:bg-elevated">
                      <FileSpreadsheet className="h-3 w-3" /> Excel
                    </button>
                  )}
                  <button onClick={() => openSend(def)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 text-[11px] hover:bg-elevated">
                    <Mail className="h-3 w-3" /> Send
                    {cfg.recipients.length > 0 && (
                      <span className="rounded-full bg-primary/20 px-1 text-[9px] text-primary">{cfg.recipients.length}</span>
                    )}
                  </button>
                  <button onClick={() => openEdit(def)}
                    className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 text-[11px] hover:bg-elevated">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                </div>
              </Panel>
            );
          })}
        </div>
      </main>

      {/* ── Report Viewer modal ───────────────────────────────────────────── */}
      {viewingDef && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-panel shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h2 className="text-sm font-semibold">{viewingDef.title}</h2>
                <p className="text-[11px] text-muted-foreground">{rangeLabel(viewingDef.id)}</p>
              </div>
              <div className="flex items-center gap-2">
                {viewData && (
                  <>
                    <button onClick={() => downloadPDF(viewingDef, viewData, reportConfigs[viewingDef.id].range)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] hover:bg-elevated">
                      <Download className="h-3 w-3" /> PDF
                    </button>
                    {viewingDef.supportsExcel && (
                      <button onClick={() => downloadExcel(viewingDef, viewData)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] hover:bg-elevated">
                        <FileSpreadsheet className="h-3 w-3" /> Excel
                      </button>
                    )}
                  </>
                )}
                <button onClick={() => setViewingDef(null)} className="ml-2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-5">
              {viewLoading && (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating report…
                </div>
              )}
              {viewError && (
                <div className="rounded-md bg-critical/10 px-3 py-2 text-xs text-critical">{viewError}</div>
              )}
              {viewData && !viewLoading && (
                <ReportContent def={viewingDef} data={viewData} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Send modal ────────────────────────────────────────────────────── */}
      {sendingDef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Send — {sendingDef.title}</h2>
              <button onClick={() => setSendingDef(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            {(telegramAvailable || slackAvailable) && (
              <div className="mb-3 rounded-md bg-elevated/50 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
                {telegramAvailable && <p>Telegram recipients starting with <code>@</code> will be sent when the scheduled run fires.</p>}
                {slackAvailable && <p>Slack recipients prefixed with <code>slack:</code> will be notified via the Slack integration.</p>}
              </div>
            )}

            <div className="mb-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recipients</div>
              <div className="flex gap-2">
                <input
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addRecipient(sendingDef.id)}
                  placeholder={`user@email.com${telegramAvailable ? ', @telegram' : ''}${slackAvailable ? ', slack:@user' : ''}`}
                  className="input flex-1 text-[11px]"
                />
                <button onClick={() => addRecipient(sendingDef.id)}
                  className="h-9 rounded-md bg-primary px-3 text-xs text-primary-foreground">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {reportConfigs[sendingDef.id].recipients.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md bg-elevated/50 px-2.5 py-1.5 text-[11px]">
                    <span className="font-mono">{r}</span>
                    <button onClick={() => removeRecipient(sendingDef.id, i)}>
                      <Trash2 className="h-3 w-3 text-critical/70" />
                    </button>
                  </div>
                ))}
                {reportConfigs[sendingDef.id].recipients.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No recipients yet.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => setSendingDef(null)}
                className="h-8 rounded-md border border-border px-3 text-xs hover:bg-elevated">Cancel</button>
              <button onClick={() => sendByEmail(sendingDef)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground">
                <Send className="h-3.5 w-3.5" /> Send via Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ────────────────────────────────────────────────────── */}
      {editingDef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Edit — {editingDef.title}</h2>
              <button onClick={() => setEditingDef(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Frequency</label>
                <select value={editForm.frequency} onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })} className="input">
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Time Range</label>
                <select value={editForm.range} onChange={(e) => setEditForm({ ...editForm, range: e.target.value })} className="input">
                  {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recipients</label>
                <div className="flex gap-2">
                  <input
                    value={newRecipient}
                    onChange={(e) => setNewRecipient(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setEditForm((f) => ({ ...f, recipients: [...f.recipients, newRecipient.trim()] })); setNewRecipient(''); }}}
                    placeholder="user@example.com"
                    className="input flex-1 text-[11px]"
                  />
                  <button
                    onClick={() => { if (newRecipient.trim()) { setEditForm((f) => ({ ...f, recipients: [...f.recipients, newRecipient.trim()] })); setNewRecipient(''); }}}
                    className="h-9 rounded-md bg-primary px-3 text-xs text-primary-foreground">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1 space-y-1">
                  {editForm.recipients.map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-elevated/50 px-2 py-1 text-[11px]">
                      <span className="font-mono">{r}</span>
                      <button onClick={() => setEditForm((f) => ({ ...f, recipients: f.recipients.filter((_, idx) => idx !== i) }))}>
                        <Trash2 className="h-3 w-3 text-critical/70" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditingDef(null)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-elevated">Cancel</button>
              <button onClick={saveEdit} className="h-8 rounded-md bg-primary px-3 text-xs text-primary-foreground">Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Report content renderer ──────────────────────────────────────────────────

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  const color = tone === 'up' ? 'text-success' : tone === 'warn' ? 'text-warning' : tone === 'down' ? 'text-critical' : 'text-foreground';
  return (
    <div className="rounded-md border border-border bg-elevated/40 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function ReportContent({ def, data }: { def: ReportDef; data: Record<string, unknown> }) {
  if (def.id === 'device-health') {
    const d = data as { summary: { total: number; up: number; warn: number; down: number }; topByCpu: { name: string; site: string; cpu: number; mem: number }[] };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          <StatCard label="Total Devices" value={d.summary.total} />
          <StatCard label="Up" value={d.summary.up} tone="up" />
          <StatCard label="Warning" value={d.summary.warn} tone="warn" />
          <StatCard label="Down" value={d.summary.down} tone="down" />
        </div>
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Top Devices by CPU</h3>
          <ReportTable
            headers={['Device', 'Site', 'CPU %', 'Memory %']}
            rows={d.topByCpu.map((r) => [r.name, r.site, `${r.cpu}%`, `${r.mem}%`])}
          />
        </div>
      </div>
    );
  }

  if (def.id === 'interface-utilization') {
    const d = data as { interfaces: { name: string; device: string; avgIn: number; avgOut: number; peakIn: number; peakOut: number }[] };
    return (
      <ReportTable
        headers={['Interface', 'Device', 'Avg In', 'Avg Out', 'Peak In', 'Peak Out']}
        rows={d.interfaces.map((r) => [r.name, r.device, `${r.avgIn} Mbps`, `${r.avgOut} Mbps`, `${r.peakIn} Mbps`, `${r.peakOut} Mbps`])}
      />
    );
  }

  if (def.id === 'alert-summary') {
    const d = data as { summary: { total: number; critical: number; major: number; minor: number }; topDevices: { name: string; alertCount: number }[] };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          <StatCard label="Total Alerts" value={d.summary.total} />
          <StatCard label="Critical" value={d.summary.critical} tone="down" />
          <StatCard label="Major" value={d.summary.major} tone="warn" />
          <StatCard label="Minor" value={d.summary.minor} />
        </div>
        {d.topDevices.length > 0 && (
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Top Devices by Alert Count</h3>
            <ReportTable
              headers={['Device', 'Alert Count']}
              rows={d.topDevices.map((r) => [r.name, r.alertCount])}
            />
          </div>
        )}
      </div>
    );
  }

  if (def.id === 'availability') {
    const d = data as { devices: { name: string; site: string; status: string; availability: number }[] };
    return (
      <ReportTable
        headers={['Device', 'Site', 'Status', 'Availability']}
        rows={d.devices.map((r) => [r.name, r.site, r.status, `${r.availability}%`])}
      />
    );
  }

  return <pre className="text-xs text-muted-foreground">{JSON.stringify(data, null, 2)}</pre>;
}

function ReportTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr className="border-b border-border">
            {headers.map((h) => <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-2 py-6 text-center text-muted-foreground">No data</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="hover:bg-elevated/40">
              {row.map((cell, j) => <td key={j} className="px-2 py-2 font-mono">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
