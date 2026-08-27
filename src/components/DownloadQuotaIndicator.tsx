"use client";

import { useEffect, useState, type ReactElement } from "react";
import type { QuotaStatus } from "@/lib/download-quota";

type LoadState = QuotaStatus | "hidden";

export default function DownloadQuotaIndicator(): ReactElement | null {
  const [status, setStatus] = useState<LoadState>("hidden");

  useEffect(() => {
    let active = true;

    async function loadQuota(): Promise<void> {
      try {
        const response = await fetch("/api/me/download-quota", { method: "GET" });

        if (!active || response.status === 401 || !response.ok) {
          if (active) {
            setStatus("hidden");
          }
          return;
        }

        const payload = (await response.json()) as QuotaStatus;
        if (active) {
          setStatus(payload);
        }
      } catch {
        if (active) {
          setStatus("hidden");
        }
      }
    }

    void loadQuota();

    return () => {
      active = false;
    };
  }, []);

  if (status === "hidden") {
    return null;
  }

  if (status.tier === "premium") {
    return (
      <aside aria-live="polite">
        <p>Premium plan: Unlimited downloads.</p>
      </aside>
    );
  }

  const remaining = Math.max(status.limit - status.used, 0);

  return (
    <aside aria-live="polite">
      <p>
        {remaining} downloads remaining this month. Resets at {status.reset_at} (UTC).
      </p>
      {remaining === 0 ? (
        <a href={status.upgrade_url} aria-label="Upgrade to premium for unlimited downloads">
          Upgrade to premium
        </a>
      ) : null}
    </aside>
  );
}
