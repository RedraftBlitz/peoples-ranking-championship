"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const DEDUPE_WINDOW_MS = 15_000;

export function TrafficTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    try {
      const key = `prc-traffic:${pathname}`;
      const lastTrackedAt = Number(window.sessionStorage.getItem(key) ?? "0");
      if (Date.now() - lastTrackedAt < DEDUPE_WINDOW_MS) return;
      window.sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // Browsers that disable session storage can still be counted normally.
    }

    void fetch("/api/traffic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      cache: "no-store",
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
