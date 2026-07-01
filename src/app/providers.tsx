"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { makeQueryClient } from "@/lib/query/client";

/**
 * Client-side app providers. Currently hosts the TanStack Query cache so any
 * component can read server data cache-first (instant on revisit) and let it
 * revalidate in the background. The QueryClient is created once per browser
 * session via useState so it survives re-renders but isn't shared across
 * requests on the server.
 */
export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
