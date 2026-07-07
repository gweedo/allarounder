import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET_KEY ?? "change-me-in-production"
);

const FALLBACK_API_URL = "http://backend:8000";

export const config = {
  matcher: ["/admin/:path*"],
};

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // The login page itself must be accessible without a token.
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get("access_token")?.value;

  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
      return NextResponse.next();
    } catch {
      // Falls through to the refresh attempt below.
    }
  }

  // The access token is missing or expired — try a silent refresh using the
  // long-lived refresh token before bouncing the writer to the login page.
  const refreshToken = request.cookies.get("refresh_token")?.value;
  if (!refreshToken) {
    return redirectToLogin(request);
  }

  return attemptRefresh(request, refreshToken);
}

async function attemptRefresh(
  request: NextRequest,
  refreshToken: string
): Promise<NextResponse> {
  const base = process.env.API_URL ?? FALLBACK_API_URL;

  try {
    const upstream = await fetch(`${base}/api/admin/auth/refresh`, {
      method: "POST",
      headers: { cookie: `refresh_token=${refreshToken}` },
    });

    if (!upstream.ok) {
      return redirectToLogin(request);
    }

    const response = NextResponse.next();
    for (const cookie of upstream.headers.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch {
    return redirectToLogin(request);
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/admin/login", request.url);
  return NextResponse.redirect(loginUrl, { status: 302 });
}
