import { NextResponse } from "next/server";

/**
 * Liveness probe for load balancers, uptime monitors and deployment checks.
 *
 * Deliberately dependency-free: no authentication, no database, no
 * environment variables, no external services. It answers whether the web
 * process is alive, nothing more. Readiness of downstream systems (database,
 * search index, payment providers) is verified by their own dedicated
 * checks, never by overloading this endpoint.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: "sparelink-india-web" },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
