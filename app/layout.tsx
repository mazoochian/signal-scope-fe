import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    template: "%s — SignalScope NMS",
    default: "SignalScope NMS",
  },
  description:
    "SignalScope NMS — real-time network monitoring, alerting, and management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex h-full overflow-hidden bg-background text-foreground">
        <Providers>
          <Sidebar />
          <div className="min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
