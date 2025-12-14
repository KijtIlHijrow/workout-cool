"use client";

import { useSession } from "@/features/auth/lib/auth-client";

export function useUserSubscription() {
  const { ...rest } = useSession();
  // Premium unlocked for self-hosted instance
  const isPremium = true;

  return { isPremium, ...rest };
}
