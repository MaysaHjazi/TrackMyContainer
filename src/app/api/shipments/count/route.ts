import { NextResponse }                              from "next/server";
import { getAuthenticatedUser, canAddShipment }      from "@/lib/auth";

/**
 * GET /api/shipments/count
 * Returns current shipment count vs plan limit for the authenticated user.
 * Used by the counter widget on the dashboard and Add Shipment page.
 *
 * Response:
 *   { current: number, max: number | null, plan: string, allowed: boolean }
 *   max is null for CUSTOM plan (unlimited)
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await canAddShipment(user.id);

  return NextResponse.json({
    current: result.current,
    max:     result.max === Infinity ? null : result.max,  // null = unlimited (CUSTOM)
    plan:    result.plan,
    allowed: result.allowed,
  });
}
