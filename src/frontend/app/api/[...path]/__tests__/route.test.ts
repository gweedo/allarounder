// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "../route";

const originalFetch = global.fetch;

function ctx(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe("API proxy route handler", () => {
  beforeEach(() => {
    process.env.API_URL = "https://backend.internal.example";
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("forwards method, path, and query to API_URL at runtime", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    global.fetch = fetchMock;

    const req = new NextRequest("https://app.example/api/admin/auth/login?x=1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.c" }),
    });
    const res = await POST(req, ctx(["admin", "auth", "login"]));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://backend.internal.example/api/admin/auth/login?x=1",
    );
    expect(init.method).toBe("POST");
    expect(res.status).toBe(200);
  });

  it("forwards every Set-Cookie header individually", async () => {
    const upstream = new Response("ok", { status: 200 });
    upstream.headers.append("set-cookie", "access_token=a; Path=/; HttpOnly");
    upstream.headers.append("set-cookie", "refresh_token=r; Path=/; HttpOnly");
    global.fetch = vi.fn().mockResolvedValue(upstream);

    const req = new NextRequest("https://app.example/api/admin/auth/login", {
      method: "POST",
    });
    const res = await POST(req, ctx(["admin", "auth", "login"]));

    const cookies = res.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
  });

  it("returns 502 with the error cause when the upstream fetch fails", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("fetch failed"), {
          cause: new Error("ECONNREFUSED"),
        }),
      );

    const req = new NextRequest("https://app.example/api/articles", {
      method: "GET",
    });
    const res = await GET(req, ctx(["articles"]));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("fetch failed");
    expect(body.cause).toBe("ECONNREFUSED");
  });
});
