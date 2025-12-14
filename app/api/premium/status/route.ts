import { NextResponse } from "next/server";

/**
 * Get Premium Status (Unified)
 *
 * GET /api/premium/status
 *
 * Premium unlocked for self-hosted instance
 */
export async function GET() {
  // Premium unlocked for self-hosted instance
  return NextResponse.json({
    isPremium: true,
    source: "self-hosted",
    subscriptions: {
      hasRevenueCat: false,
      hasStripe: false,
      count: 0,
    },
    currentSubscription: null,
    legacyMessage: null,
  });
}
