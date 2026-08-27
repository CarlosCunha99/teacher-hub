"use client";

import type { CurrentUser } from "@/lib/auth";
import type { Comment } from "@/lib/comments/service";
import { CommentCard } from "./CommentCard";

type ReplyListProps = {
  currentUser: CurrentUser | null;
  replies: Comment[];
  onDelete: (commentId: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
};

export function ReplyList({ currentUser, replies, onDelete, onEdit }: ReplyListProps) {
  if (replies.length === 0) {
    return null;
  }

  return (
    <ul style={{ display: "grid", gap: 12, listStyle: "none", margin: 0, padding: 0 }}>
      {replies.map((reply) => (
        <li key={reply.id}>
          <CommentCard
            comment={reply}
            currentUser={currentUser}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        </li>
      ))}
    </ul>
  );
}
