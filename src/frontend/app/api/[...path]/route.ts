import { NextRequest, NextResponse } from "next/server";

// Run on the Node runtime (needs Node fetch to the internal backend) and never
// cache — this is a live proxy.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_API_URL = "http://backend:8000";

// Hop-by-hop / connection headers that must not be forwarded verbatim.
const STRIP_REQUEST_HEADERS = ["host", "connection", "content-length", "transfer-encoding"];

/**
 * Runtime reverse proxy for all /api/* calls.
 *
 * The backend has internal-only ingress and Front Door routes everything to the
 * frontend, so the browser can only reach the backend through here. This must be
 * a route handler (evaluated per request) rather than a next.config rewrite,
 * because rewrites freeze process.env.API_URL at build time — when it is unset —
 * pinning the destination to the unreachable fallback.
 */
async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const base = process.env.API_URL ?? FALLBACK_API_URL;
  const target = `${base}/api/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  for (const h of STRIP_REQUEST_HEADERS) headers.delete(h);

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
    // Self-diagnosing: surface the real failure instead of an opaque 500.
    console.error(`API proxy failed: ${req.method} ${target} — ${message}${cause ? ` | ${cause}` : ""}`);
    return NextResponse.json(
      { detail: "Upstream request failed", target, error: message, cause },
      { status: 502 },
    );
  }

  // Relay the response. Set-Cookie must be handled separately: undici collapses
  // multiple Set-Cookie headers into one comma-joined value, which corrupts
  // cookies — getSetCookie() returns them as an array to re-append individually.
  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") resHeaders.set(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) {
    resHeaders.append("set-cookie", cookie);
  }

  // 204 / 304 must carry no body — passing even an empty ArrayBuffer throws.
  const isBodyless = upstream.status === 204 || upstream.status === 304;
  return new NextResponse(isBodyless ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
  handler as HEAD,
};
