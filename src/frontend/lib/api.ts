/**
 * Client-side fetch wrapper for admin API calls.
 *
 * All browser calls go through the same-origin reverse proxy at /api/*, which
 * relays cookies to the backend (see app/api/[...path]/route.ts). The access
 * token cookie is short-lived (30 min); when it expires mid-session the admin
 * middleware can silently refresh it on navigation, but a fetch made from
 * client-side JS in between navigations would otherwise just see a bare 401.
 *
 * apiFetch mirrors that behavior for fetch calls: on a 401 from an admin
 * endpoint, it performs a single (deduplicated) refresh and retries the
 * original request once. If the refresh itself fails, the original 401 is
 * returned so the caller (or a subsequent navigation, which the middleware
 * intercepts) can send the user to /admin/login.
 */

const ADMIN_PREFIX = "/api/admin/";
const REFRESH_PATH = "/api/admin/auth/refresh";
const LOGIN_PATH = "/api/admin/auth/login";

let inFlightRefresh: Promise<boolean> | null = null;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

// Only 401s from admin endpoints (other than the auth endpoints themselves)
// should trigger a refresh — public endpoints don't carry a session, and
// refreshing in response to the refresh/login calls failing would loop.
function shouldAttemptRefresh(url: string): boolean {
  return (
    url.includes(ADMIN_PREFIX) &&
    !url.includes(REFRESH_PATH) &&
    !url.includes(LOGIN_PATH)
  );
}

function refreshOnce(): Promise<boolean> {
  if (!inFlightRefresh) {
    inFlightRefresh = fetch(REFRESH_PATH, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        inFlightRefresh = null;
      });
  }
  return inFlightRefresh;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, { ...init, credentials: "include" });

  if (response.status !== 401) return response;
  if (!shouldAttemptRefresh(urlOf(input))) return response;

  const refreshed = await refreshOnce();
  if (!refreshed) return response;

  return fetch(input, { ...init, credentials: "include" });
}

/** Test-only helper to reset the single-flight refresh state between tests. */
export function _resetForTests(): void {
  inFlightRefresh = null;
}
