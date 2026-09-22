import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.includes("session_token") ||
        cookie.name.includes("better-auth.session"),
    );
}

function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function isDealerPath(pathname: string) {
  return pathname.startsWith("/dealer") || pathname.startsWith("/api/dealer");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookie = request.headers.get("cookie");
  const sessionCookie = hasSessionCookie(request);

  if ((isAdminPath(pathname) || isDealerPath(pathname)) && !sessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }
    const login = new URL(
      isDealerPath(pathname) ? "/login/dealer" : "/login",
      request.nextUrl.origin,
    );
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

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
    "/admin",
    "/admin/:path*",
    "/dealer",
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
  ],
};
