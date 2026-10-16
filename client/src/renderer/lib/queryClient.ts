import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Queries read local SQLite through IPC, even without a network connection.
      networkMode: "always",
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 0,
    },

    mutations: {
      // Local writes must run immediately; Electron manages eventual server sync.
      networkMode: "always",
      retry: 0,
    },
  },
});
