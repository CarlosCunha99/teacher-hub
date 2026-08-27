"use client";

import { useMemo, useState } from "react";
import type { CurrentUser } from "@/lib/auth";
import type { Comment } from "@/lib/comments/service";
import { CommentComposer } from "./CommentComposer";

type CommentCardProps = {
  comment: Comment;
  currentUser: CurrentUser | null;
  onDelete: (commentId: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onReply?: (commentId: string, body: string) => Promise<void>;
};

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function CommentCard({ comment, currentUser, onDelete, onEdit, onReply }: CommentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const canEdit = currentUser?.id === comment.authorId && !comment.deletedAt;
  const canDelete =
    !comment.deletedAt &&
    !!currentUser &&
    (currentUser.id === comment.authorId ||
      currentUser.role === "moderator" ||
      currentUser.role === "admin");
  const showReplyAction = !!currentUser && !!onReply && !comment.deletedAt;
  const metaLabel = useMemo(() => {
    const parts = [formatTimestamp(comment.createdAt)];

    if (comment.editedAt) {
      parts.push("edited");
    }

    return parts.join(" • ");
  }, [comment.createdAt, comment.editedAt]);

  async function handleEdit(body: string) {
    await onEdit(comment.id, body);
    setIsEditing(false);
  }

  async function handleReply(body: string) {
    if (!onReply) {
      return;
    }

    await onReply(comment.id, body);
    setIsReplying(false);
  }

  return (
    <article
      id={`comment-${comment.id}`}
      style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 16 }}
    >
      <header style={{ marginBottom: 12 }}>
        <strong>{comment.authorName ?? "Deleted user"}</strong>
        <div style={{ color: "#57606a", fontSize: 12 }}>{metaLabel}</div>
      </header>

      {isEditing ? (
        <CommentComposer
          compact
          label="Edit comment"
          onSubmit={handleEdit}
          placeholder="Update your comment"
          submitLabel="Save"
        />
      ) : (
        <p dir="auto" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {comment.body}
        </p>
      )}

      {(canEdit || canDelete || showReplyAction) && !isEditing ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {canEdit ? (
            <button onClick={() => setIsEditing(true)} type="button">
              Edit
            </button>
          ) : null}
          {canDelete ? (
            <button onClick={() => void onDelete(comment.id)} type="button">
              Delete
            </button>
          ) : null}
          {showReplyAction ? (
            <button onClick={() => setIsReplying((value) => !value)} type="button">
              {isReplying ? "Cancel reply" : "Reply"}
            </button>
          ) : null}
        </div>
      ) : null}

      {isReplying && onReply ? (
        <div style={{ marginTop: 12 }}>
          <CommentComposer
            compact
            label="Write a reply"
            onSubmit={handleReply}
            placeholder="Write a reply…"
            submitLabel="Reply"
          />
        </div>
      ) : null}
    </article>
  );
}
