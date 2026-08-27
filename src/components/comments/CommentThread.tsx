"use client";

import { useCallback, useEffect, useState } from "react";
import type { CurrentUser } from "@/lib/auth";
import type { Comment, CommentWithReplies, PaginatedResult } from "@/lib/comments/service";
import { CommentCard } from "./CommentCard";
import { CommentComposer } from "./CommentComposer";
import { ReplyList } from "./ReplyList";

type CommentThreadProps = {
  resourceId: string;
  currentUser: CurrentUser | null;
};

type ErrorPayload = {
  error?: string;
};

function updateCommentInThread(
  items: CommentWithReplies[],
  commentId: string,
  updater: (comment: Comment) => Comment
): CommentWithReplies[] {
  return items.map((item) => {
    if (item.id === commentId) {
      return {
        ...updater(item),
        replies: item.replies,
      };
    }

    return {
      ...item,
      replies: item.replies.map((reply) => (reply.id === commentId ? updater(reply) : reply)),
    };
  });
}

async function parseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
  return payload?.error ?? "Request failed";
}

export function CommentThread({ resourceId, currentUser }: CommentThreadProps) {
  const [items, setItems] = useState<CommentWithReplies[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(
    async (cursor?: string | null) => {
      const search = new URLSearchParams({ limit: "20" });

      if (cursor) {
        search.set("cursor", cursor);
      }

      const response = await fetch(`/api/resources/${resourceId}/comments?${search.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      return (await response.json()) as PaginatedResult<CommentWithReplies>;
    },
    [resourceId]
  );

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await loadComments();

        if (!isMounted) {
          return;
        }

        setItems(result.items);
        setNextCursor(result.nextCursor);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load comments.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [loadComments]);

  const handleCreateComment = useCallback(
    async (body: string) => {
      const response = await fetch(`/api/resources/${resourceId}/comments`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const comment = (await response.json()) as Comment;
      setItems((currentItems) => [...currentItems, { ...comment, replies: [] }]);
    },
    [resourceId]
  );

  const handleReply = useCallback(
    async (commentId: string, body: string) => {
      const response = await fetch(`/api/resources/${resourceId}/comments/${commentId}/replies`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const reply = (await response.json()) as Comment;
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === commentId ? { ...item, replies: [...item.replies, reply] } : item
        )
      );
    },
    [resourceId]
  );

  const handleEdit = useCallback(
    async (commentId: string, body: string) => {
      const response = await fetch(`/api/resources/${resourceId}/comments/${commentId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const updated = (await response.json()) as Comment;
      setItems((currentItems) => updateCommentInThread(currentItems, commentId, () => updated));
    },
    [resourceId]
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      const response = await fetch(`/api/resources/${resourceId}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      setItems((currentItems) =>
        updateCommentInThread(currentItems, commentId, (comment) => ({
          ...comment,
          authorId: null,
          authorName: null,
          body: "This comment has been deleted",
          deletedAt: comment.deletedAt ?? new Date().toISOString(),
        }))
      );
    },
    [resourceId]
  );

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      const result = await loadComments(nextCursor);
      setItems((currentItems) => [...currentItems, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load more comments.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [loadComments, nextCursor]);

  return (
    <section style={{ display: "grid", gap: 24 }}>
      <header>
        <h2>Comments</h2>
        <p>Share feedback, questions, and classroom tips for this resource.</p>
      </header>

      {currentUser ? (
        <CommentComposer
          label="Add a comment"
          onSubmit={handleCreateComment}
          submitLabel="Post comment"
        />
      ) : (
        <p>You must be signed in to comment.</p>
      )}

      {error ? (
        <p aria-live="polite" style={{ color: "crimson", margin: 0 }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading comments…</p> : null}

      {!isLoading && items.length === 0 ? <p>No comments yet.</p> : null}

      <ul style={{ display: "grid", gap: 16, listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((comment) => (
          <li key={comment.id}>
            <div style={{ display: "grid", gap: 12 }}>
              <CommentCard
                comment={comment}
                currentUser={currentUser}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onReply={handleReply}
              />
              <div style={{ marginLeft: 24 }}>
                <ReplyList
                  currentUser={currentUser}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  replies={comment.replies}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {nextCursor ? (
        <button disabled={isLoadingMore} onClick={() => void handleLoadMore()} type="button">
          {isLoadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </section>
  );
}
