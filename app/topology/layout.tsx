import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Topology' };

export default function TopologyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
