"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Next.js 15 requires a Suspense boundary around any use of useSearchParams()
// in a statically-rendered page, or `next build` fails. LoginPageContent reads
// `?sso=` (set by the Google OAuth callback redirect), which needs it.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ssoStatus = searchParams.get("sso");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ssoStatus === "success") {
      // The Google callback set the auth cookies on a cross-site redirect chain
      // (Set-Cookie isn't itself subject to SameSite), but they're SameSite=Strict
      // so the browser won't *send* them on that same cross-site chain. This
      // client-side navigation to /admin is same-site, so it does send them,
      // completing the sign-in.
      router.replace("/admin");
    }
  }, [ssoStatus, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember_me: rememberMe }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          res.status === 429
            ? "Troppi tentativi. Riprova tra qualche minuto."
            : data.detail ?? "Credenziali non valide."
        );
        return;
      }
      router.push("/admin");
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-container" style={{ maxWidth: 400, margin: "10vh auto" }}>
      <h1>Accedi</h1>
      {ssoStatus === "error" && (
        <p role="alert" className="alert-error">
          Accesso Google non riuscito. L&apos;email non è registrata o l&apos;account è
          disattivato.
        </p>
      )}
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="remember-me">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />{" "}
            Ricordami per 14 giorni
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: "1.5rem" }}>
          {loading ? "…" : "Accedi"}
        </button>
      </form>
      <hr style={{ margin: "1.5rem 0" }} />
      {/*
        Always rendered: the backend route 404s harmlessly when
        GOOGLE_SSO_ENABLED is off, so there is no env-gating pattern to hide
        this behind on the frontend (none exists elsewhere in this app either).
      */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- this is a
          backend API route (not a Next.js page), and must be a real full-page
          navigation so the browser follows the server's 302 to Google; next/link's
          client-side routing does not apply here. */}
      <a className="btn" href="/api/admin/auth/google/login" style={{ display: "block", textAlign: "center" }}>
        Accedi con Google
      </a>
    </main>
  );
}
