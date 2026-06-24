import type { Metadata } from "next";
export const metadata: Metadata = { title: "Service Assurance" };
export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
