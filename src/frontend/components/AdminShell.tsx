"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Bacheca", href: "/admin" },
  { label: "Articoli", href: "/admin/articles" },
  { label: "Autori", href: "/admin/authors" },
  { label: "Ospiti", href: "/admin/guests" },
  { label: "Categorie", href: "/admin/categories" },
  { label: "Tag", href: "/admin/tags" },
  { label: "Pagine", href: "/admin/pages" },
];

// The dashboard lives at the sidebar root (/admin), which is a path-prefix of
// every other section — so it needs an exact match rather than the usual
// "starts with href + /" rule, or it would light up on every admin page.
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  if (pathname === "/admin/login") {
    // No sidebar/nav chrome here, but the login screen still gets the
    // admin color/font palette via the .admin-bare hook (see globals.css).
    return <div className="admin-bare">{children}</div>;
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.push("/admin/login");
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-shell-sidebar">
        <div className="admin-shell-brand">Allarounder — Admin</div>
        <nav aria-label="Amministrazione" className="admin-shell-nav">
          <ul>
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={active ? "page" : undefined}>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <button
          type="button"
          className="btn admin-shell-logout"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          Esci
        </button>
      </aside>
      <div className="admin-shell-content">{children}</div>
    </div>
  );
}
