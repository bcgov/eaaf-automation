/**
 * Tunnel read-only access control.
 *
 * When a request arrives through a Cloudflare tunnel (any non-localhost host),
 * completed assessments become read-only. Localhost is always unrestricted.
 *
 * Usage in any mutating route handler:
 *
 *   const block = tunnelReadOnly(request, assessmentId);
 *   if (block) return block;
 *
 * To remove this feature: delete this file and remove the two-line guard blocks
 * from the protected routes.
 */

import { NextResponse } from "next/server";
import db from "@/lib/db/db";

/** True when the request did NOT originate from localhost. */
export function isTunnelRequest(request: Request): boolean {
  const host = request.headers.get("host") ?? "";
  return !host.startsWith("localhost") && !host.startsWith("127.0.0.1");
}

/**
 * Returns a 403 response if this is a tunnel request AND the assessment is completed.
 * Returns null if the operation should proceed normally.
 */
export function tunnelReadOnly(request: Request, assessmentId: number): NextResponse | null {
  if (!isTunnelRequest(request)) return null;

  const row = db
    .prepare(`SELECT status FROM assessments WHERE id = ?`)
    .get(assessmentId) as { status: string } | undefined;

  if (row?.status !== "completed") return null;

  return NextResponse.json(
    { error: "This assessment is completed and cannot be modified through external access." },
    { status: 403 }
  );
}
