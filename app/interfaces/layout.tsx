import type { Metadata } from "next";
export const metadata: Metadata = { title: "Interfaces" };
export default function InterfacesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
