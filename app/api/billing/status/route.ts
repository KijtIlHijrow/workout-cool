import { NextResponse } from "next/server";

// Premium unlocked for self-hosted instance
export async function GET() {
  return NextResponse.json({
    isPremium: true,
    expiresAt: null,
    subscription: undefined,
    license: undefined,
    canUpgrade: false,
  });
}
