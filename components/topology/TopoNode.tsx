'use client';

import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Server, Router, Shield, Cpu, Wifi, Globe } from 'lucide-react';

export type TopoNodeData = {
  label: string;
  kind: string;
  status: string;
  alertCounts: Record<string, number>;
  totalAlerts: number;
  deviceLabel: string;
  [key: string]: unknown;
};

const KIND_ICONS: Record<string, React.ElementType> = {
  core:   Cpu,
  agg:    Router,
  access: Server,
  fw:     Shield,
  router: Router,
  ap:     Wifi,
  wan:    Globe,
};

function statusColor(s: string) {
  if (s === 'up')   return 'var(--color-success)';
  if (s === 'warn') return 'var(--color-warning)';
  return 'var(--color-critical)';
}

const SEV_COLOR: Record<string, string> = {
  Critical: '#ef4444',
  Major:    '#f59e0b',
  Warning:  '#f59e0b',
  Minor:    '#60a5fa',
  Info:     '#6b7280',
};

export function TopoNode({ data, selected }: NodeProps & { data: TopoNodeData }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const Icon = KIND_ICONS[data.kind] ?? Server;
  const color = statusColor(data.status);
  const hasAlerts = data.totalAlerts > 0;

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Top}    style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />

      {/* Node circle */}
      <div
        className="relative grid h-12 w-12 cursor-pointer place-items-center rounded-full border-2 transition-transform hover:scale-110"
        style={{
          borderColor: color,
          background: 'var(--color-panel)',
          boxShadow: selected ? `0 0 0 3px ${color}40, 0 0 12px ${color}30` : `0 0 0 1px ${color}20`,
        }}
        onClick={() => router.push('/devices')}
      >
        <Icon className="h-5 w-5" style={{ color }} />

        {/* Alert badge */}
        {hasAlerts && (
          <div
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
            style={{ background: '#ef4444' }}
          >
            {data.totalAlerts}
          </div>
        )}

        {/* Down pulse */}
        {data.status === 'down' && (
          <div
            className="absolute inset-0 animate-ping rounded-full opacity-25"
            style={{ background: color }}
          />
        )}
      </div>

      {/* Label */}
      <div
        className="mt-1.5 max-w-[90px] truncate text-center font-mono text-[10px]"
        style={{ color: 'var(--color-foreground)', opacity: 0.8 }}
      >
        {data.deviceLabel}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="absolute bottom-full left-1/2 z-50 mb-3 w-52 -translate-x-1/2 rounded-xl border p-3 shadow-2xl"
          style={{
            background: 'var(--color-panel)',
            borderColor: 'var(--color-border)',
            pointerEvents: 'none',
          }}
        >
          {/* Header */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-semibold" style={{ color: 'var(--color-foreground)' }}>
              {data.deviceLabel}
            </span>
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold capitalize"
              style={{ background: `${color}20`, color }}
            >
              {data.status}
            </span>
          </div>

          {/* Kind */}
          <div className="mb-2 text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>
            {data.kind}
          </div>

          {/* Alert counts */}
          <div
            className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            Open Alerts
          </div>
          {data.totalAlerts === 0 ? (
            <div className="text-[10px]" style={{ color: '#22c55e' }}>No active alerts</div>
          ) : (
            <div className="space-y-0.5">
              {(['Critical', 'Major', 'Warning', 'Minor', 'Info'] as const).map((sev) => {
                const n = data.alertCounts[sev] ?? 0;
                if (!n) return null;
                return (
                  <div key={sev} className="flex items-center justify-between text-[10px]">
                    <span style={{ color: SEV_COLOR[sev] ?? 'var(--color-foreground)' }}>{sev}</span>
                    <span className="font-mono font-bold" style={{ color: SEV_COLOR[sev] ?? 'var(--color-foreground)' }}>
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div
            className="mt-2 border-t pt-2 text-[9px]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
          >
            Click to open device list
          </div>
        </div>
      )}
    </div>
  );
}
