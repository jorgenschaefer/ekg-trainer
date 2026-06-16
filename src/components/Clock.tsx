"use client";

import { useEffect, useState } from "react";

// Wall clock in the device topbar. Each client runs its own — phase/time is not
// synchronized across devices.
export default function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const text = now
    ? now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  return <span>{text}</span>;
}
