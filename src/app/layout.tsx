import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Peakcraft Panel — Minecraft Server Hosting Control Panel",
  description: "Create, configure, and manage Minecraft servers from a modern browser dashboard.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
