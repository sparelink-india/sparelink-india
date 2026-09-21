import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return NextResponse.next();
  }

  try {
    const flagsResponse = await fetch(
      new URL("/api/auth/session-flags", request.nextUrl.origin),
      {
        headers: { cookie },
        cache: "no-store",
      },
    );
    const flags = (await flagsResponse.json()) as {
      authenticated?: boolean;
      mustChangePassword?: boolean;
    };
    if (flags.authenticated && flags.mustChangePassword) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            error: "Password change required.",
            redirectTo: "/account/change-password",
          },
          { status: 403 },
        );
      }
      return NextResponse.redirect(
        new URL("/account/change-password", request.nextUrl.origin),
      );
    }
  } catch {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dealer/:path*",
    "/cart/:path*",
    "/checkout/:path*",
    "/profile/:path*",
    "/orders/:path*",
    "/wishlist/:path*",
    "/api/admin/:path*",
    "/api/dealer/:path*",
    "/api/cart/:path*",
    "/api/orders/:path*",
    "/api/profile/:path*",
    "/api/wishlist/:path*",
    "/api/enquiries/:path*",
    "/api/garage/:path*",
    "/api/returns/:path*",
    "/api/warranty/:path*",
    "/api/payments/:path*",
    "/api/b2b/:path*",
    "/api/support/:path*",
  ],
};
