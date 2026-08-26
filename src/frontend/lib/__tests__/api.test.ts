import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch, _resetForTests } from "../api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  global.fetch = vi.fn();
  _resetForTests();
});

describe("apiFetch", () => {
  it("passes credentials: include on every request", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ ok: true })
    );

    await apiFetch("/api/admin/articles");

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.credentials).toBe("include");
  });

  it("does not touch non-401 responses", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ ok: true }, 200)
    );

    const res = await apiFetch("/api/admin/articles");

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("does not attempt a refresh for non-admin URLs, even on 401", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({}, 401)
    );

    const res = await apiFetch("/api/public/whatever");

    expect(res.status).toBe(401);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("does not attempt a refresh for the refresh endpoint itself", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({}, 401)
    );

    const res = await apiFetch("/api/admin/auth/refresh", { method: "POST" });

    expect(res.status).toBe(401);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("does not attempt a refresh for the login endpoint itself", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({}, 401)
    );

    const res = await apiFetch("/api/admin/auth/login", { method: "POST" });

    expect(res.status).toBe(401);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("on 401 from an admin URL, refreshes then retries the original request once", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401)) // original request
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200)) // refresh call
      .mockResolvedValueOnce(jsonResponse({ items: [] }, 200)); // retried request

    const res = await apiFetch("/api/admin/articles");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/admin/auth/refresh");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/admin/articles");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ items: [] });
  });

  it("surfaces the original 401 when the refresh itself fails", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401)) // original request
      .mockResolvedValueOnce(jsonResponse({}, 401)); // refresh call fails

    const res = await apiFetch("/api/admin/articles");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(401);
  });

  it("shares a single in-flight refresh across concurrent 401s", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    let resolveRefresh!: (r: Response) => void;
    const refreshPromise = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });

    fetchMock.mockImplementation((input: unknown) => {
      const url = String(input);
      if (url === "/api/admin/auth/refresh") {
        return refreshPromise;
      }
      if (url === "/api/admin/articles") {
        return Promise.resolve(jsonResponse({}, 401));
      }
      if (url === "/api/admin/tags") {
        return Promise.resolve(jsonResponse({}, 401));
      }
      throw new Error(`unexpected url ${url}`);
    });

    // Both requests fail with 401 concurrently before the refresh resolves.
    const p1 = apiFetch("/api/admin/articles");
    const p2 = apiFetch("/api/admin/tags");

    // Let both original requests run and hit 401, queueing the refresh.
    await Promise.resolve();
    await Promise.resolve();

    resolveRefresh(jsonResponse({ ok: true }, 200));

    // The retried requests will also 401 in this simplified mock, which is fine —
    // we only care that refresh was invoked exactly once.
    fetchMock.mockImplementation((input: unknown) => {
      const url = String(input);
      if (url === "/api/admin/articles" || url === "/api/admin/tags") {
        return Promise.resolve(jsonResponse({ ok: true }, 200));
      }
      throw new Error(`unexpected retry url ${url}`);
    });

    await Promise.all([p1, p2]);

    const refreshCalls = fetchMock.mock.calls.filter(
      ([url]) => String(url) === "/api/admin/auth/refresh"
    );
    expect(refreshCalls).toHaveLength(1);
  });
});
