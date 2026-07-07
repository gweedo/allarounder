// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

import { middleware } from "../middleware";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET_KEY ?? "change-me-in-production"
);

const originalFetch = global.fetch;

async function makeAccessToken(exp: string): Promise<string> {
  return new SignJWT({ sub: "user-1" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(JWT_SECRET);
}

function requestWithCookies(
  path: string,
  cookies: Record<string, string>
): NextRequest {
  const req = new NextRequest(`https://app.example${path}`);
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

describe("admin middleware", () => {
  beforeEach(() => {
    delete process.env.JWT_SECRET_KEY;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("passes through the login page without checking cookies", async () => {
    const req = requestWithCookies("/admin/login", {});
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("passes through untouched when the access token is valid", async () => {
    const token = await makeAccessToken("30m");
    const req = requestWithCookies("/admin", { access_token: token });
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("silently refreshes when the access token is expired and a refresh cookie exists", async () => {
    const expired = await makeAccessToken("-1s");
    const req = requestWithCookies("/admin", {
      access_token: expired,
      refresh_token: "some-refresh-token",
    });

    const upstream = new Response("ok", { status: 200 });
    upstream.headers.append(
      "set-cookie",
      "access_token=new-access; Path=/; HttpOnly"
    );
    upstream.headers.append(
      "set-cookie",
      "refresh_token=new-refresh; Path=/; HttpOnly"
    );
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    global.fetch = fetchMock;

    const res = await middleware(req);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/admin/auth/refresh");
    expect(init.method).toBe("POST");
    expect(init.headers.cookie).toBe("refresh_token=some-refresh-token");

    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith("access_token=new-access"))).toBe(
      true
    );
    expect(
      cookies.some((c) => c.startsWith("refresh_token=new-refresh"))
    ).toBe(true);
  });

  it("silently refreshes when the access token is missing but a refresh cookie exists", async () => {
    const req = requestWithCookies("/admin", {
      refresh_token: "some-refresh-token",
    });

    const upstream = new Response("ok", { status: 200 });
    upstream.headers.append(
      "set-cookie",
      "access_token=new-access; Path=/; HttpOnly"
    );
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    global.fetch = fetchMock;

    const res = await middleware(req);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it("redirects to /admin/login when the refresh call fails", async () => {
    const expired = await makeAccessToken("-1s");
    const req = requestWithCookies("/admin", {
      access_token: expired,
      refresh_token: "bad-refresh-token",
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));
    global.fetch = fetchMock;

    const res = await middleware(req);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/admin/login");
  });

  it("redirects to /admin/login when there is no access or refresh cookie", async () => {
    const req = requestWithCookies("/admin", {});
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const res = await middleware(req);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/admin/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
