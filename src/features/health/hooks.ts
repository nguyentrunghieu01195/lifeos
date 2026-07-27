"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { HealthSnapshot } from "./types";

export const HEALTH_QUERY_KEY = ["health"] as const;

async function fetchHealth(): Promise<HealthSnapshot> {
  const response = await fetch("/api/health");
  if (!response.ok) throw new Error("Failed to load health data.");
  return (await response.json()) as HealthSnapshot;
}

export function useHealth(initial: HealthSnapshot) {
  return useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: fetchHealth,
    initialData: initial,
    staleTime: 15_000,
  });
}

export function useInvalidateHealth(): () => void {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
}
