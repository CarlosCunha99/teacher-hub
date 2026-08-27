"use client";

import { useState } from "react";

const COMMENT_MAX_LENGTH = 2000;

type CommentComposerProps = {
  label: string;
  onSubmit: (body: string) => Promise<void>;
  submitLabel?: string;
  placeholder?: string;
  compact?: boolean;
};

export function CommentComposer({
  label,
  onSubmit,
  submitLabel = "Submit",
  placeholder = "Write a comment…",
  compact = false,
}: CommentComposerProps) {
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = body.trim();

    if (!trimmed) {
      setError("Comment body cannot be empty.");
      return;
    }

    if (trimmed.length > COMMENT_MAX_LENGTH) {
      setError(`Comment body must be ${COMMENT_MAX_LENGTH} characters or fewer.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(body);
      setBody("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit comment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
        <span>{label}</span>
        <textarea
          aria-label={label}
          dir="auto"
          maxLength={COMMENT_MAX_LENGTH}
          onChange={(event) => setBody(event.target.value)}
          placeholder={placeholder}
          rows={compact ? 3 : 5}
          style={{ display: "block", marginTop: 8, width: "100%" }}
          value={body}
        />
      </label>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <span aria-live="polite" style={{ fontSize: 12 }}>
          {body.trim().length}/{COMMENT_MAX_LENGTH}
        </span>
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving…" : submitLabel}
        </button>
      </div>
      {error ? (
        <p aria-live="polite" style={{ color: "crimson", marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
