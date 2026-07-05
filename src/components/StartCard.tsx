"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./StartCard.module.css";

const JOIN_ERROR = "Code unbekannt oder Sitzung abgelaufen.";

export default function StartCard() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/session/${code}`);
      if (res.ok) {
        router.push(`/monitor/${code}`);
      } else {
        setError(JOIN_ERROR);
      }
    } catch {
      setError(JOIN_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/session", { method: "POST" });
      if (!res.ok) throw new Error("create failed");
      const { code: newCode, adminToken } = await res.json();
      // Cache the token as a same-device fallback so a bare /admin/:code (no hash)
      // still restores control.
      localStorage.setItem(`admin:${newCode}`, adminToken);
      router.push(`/admin/${newCode}#${adminToken}`);
    } catch {
      setError("Sitzung konnte nicht erstellt werden. Bitte erneut versuchen.");
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>EKG-Rhythmus-Trainer</h1>

        <form
          className={styles.join}
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 4) join();
          }}
        >
          <label className={styles.label} htmlFor="code">
            Als Monitor beitreten
          </label>
          <input
            id="code"
            aria-label="Sitzungscode"
            className={styles.code}
            inputMode="numeric"
            autoComplete="off"
            placeholder="----"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
          />
          <button
            type="submit"
            className={styles.joinButton}
            disabled={code.length !== 4 || busy}
          >
            Beitreten
          </button>
          {error && (
            <p className={styles.error} role="alert">
              <span className={styles.errorDot} aria-hidden="true" />
              {error}
            </p>
          )}
        </form>

        <div className={styles.divider}>oder</div>

        <button
          type="button"
          className={styles.create}
          onClick={create}
          disabled={busy}
        >
          Neu
        </button>
      </div>
    </main>
  );
}
