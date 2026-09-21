"use client";

import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster theme="dark" position="top-right" richColors closeButton />
    </>
  );
}
