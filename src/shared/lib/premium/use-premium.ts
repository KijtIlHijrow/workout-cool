"use client";

import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/features/auth/lib/auth-client";

import type { PremiumStatus, UserSubscription } from "@/shared/types/premium.types";

export function usePremiumStatus() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ["premium-status", session?.user?.id],
    queryFn: async (): Promise<PremiumStatus> => {
      // Premium unlocked for self-hosted instance
      return { isPremium: true };
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useSubscription() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ["subscription", session?.user?.id],
    queryFn: async (): Promise<UserSubscription> => {
      // Premium unlocked for self-hosted instance
      return { isActive: true };
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Simple boolean check - most common use case
export function useIsPremium(): boolean {
  // Premium unlocked for self-hosted instance
  return true;
}
