"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminView from "@/components/AdminView";
import { resolveAdminToken } from "@/lib/admin-token";

export default function AdminPage() {
  const { code } = useParams<{ code: string }>();
  // undefined = still resolving on the client; null = no token for this device.
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const resolved = resolveAdminToken(code, window.location.hash, window.localStorage);
    setToken(resolved);
    // Drop the token from the address bar once cached — it lives in localStorage now.
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname);
    }
  }, [code]);

  if (token === undefined) return null;
  if (token === null) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <p>Keine Steuerungsberechtigung auf diesem Gerät.</p>
          <Link href="/">Zur Startseite</Link>
        </div>
      </main>
    );
  }
  return <AdminView code={code} token={token} />;
}
