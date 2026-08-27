"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface TermsAcceptanceModalProps {
  termsVersion: string;
  termsText: string;
  onAccepted?: () => void;
}

export default function TermsAcceptanceModal({
  termsVersion,
  termsText,
  onAccepted,
}: TermsAcceptanceModalProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    setSubmitting(true);

    const response = await fetch("/api/terms-acceptance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: termsVersion }),
    }).catch(() => null);

    setSubmitting(false);

    if (!response?.ok) {
      return;
    }

    if (onAccepted) {
      onAccepted();
      return;
    }

    router.refresh();
  }

  return (
    <div role="dialog" aria-modal="true">
      <h2>Accept terms of use to continue</h2>
      <p>{termsText}</p>
      <p>
        <a href="/terms">Read the full terms of use</a>
      </p>
      <label htmlFor="terms-acceptance-checkbox">
        <input
          id="terms-acceptance-checkbox"
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        I have read and accept the current terms of use
      </label>
      <div>
        <button type="button" disabled={!checked || submitting} onClick={handleSubmit}>
          Accept and continue
        </button>
      </div>
    </div>
  );
}
