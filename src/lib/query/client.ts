import { QueryClient } from "@tanstack/react-query";

/**
 * Shared TanStack Query client factory.
 *
 * Defaults are tuned for an ERP: data is treated as fresh for a short window
 * (so re-opening an app you just visited renders instantly from cache with no
 * network wait), then revalidated in the background on the next access. We do
 * NOT refetch on every window focus — that would cause request storms across
 * 34 apps — but we do refetch on reconnect so stale data self-heals.
 *
 * This is a pure read-caching layer. It never changes what the server returns
 * or enforces; it only remembers responses so the UI can paint sooner.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Fresh for 60s → revisits within a minute skip the network entirely.
        staleTime: 60_000,
        // Keep unused data cached for 10 min so back/forward stays instant.
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });
}
