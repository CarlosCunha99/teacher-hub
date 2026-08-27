"use client";

import type { Notification } from "@/lib/comments/service";

type NotificationListProps = {
  items: Notification[];
  onRead: (notification: Notification) => Promise<void>;
};

function getNotificationLabel(notification: Notification): string {
  switch (notification.type) {
    case "comment_on_resource":
      return "New comment on your resource";
    case "reply_to_comment":
      return "New reply to your comment";
    default:
      return "New notification";
  }
}

export function NotificationList({ items, onRead }: NotificationListProps) {
  if (items.length === 0) {
    return <p style={{ margin: 0 }}>You&apos;re all caught up.</p>;
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((notification) => (
        <li key={notification.id} style={{ borderTop: "1px solid #d0d7de" }}>
          <a
            href={`/resources/${notification.resourceId}#comment-${notification.commentId}`}
            onClick={(event) => {
              event.preventDefault();
              void onRead(notification);
            }}
            style={{ display: "block", padding: 12, textDecoration: "none" }}
          >
            <strong>{getNotificationLabel(notification)}</strong>
            <div style={{ color: "#57606a", fontSize: 12 }}>
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(notification.createdAt))}
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
