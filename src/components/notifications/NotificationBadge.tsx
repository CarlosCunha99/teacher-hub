"use client";

import { useCallback, useEffect, useState } from "react";
import type { Notification } from "@/lib/comments/service";
import { NotificationList } from "./NotificationList";

type NotificationResponse = {
  items: Notification[];
};

export function NotificationBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  const loadNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as NotificationResponse;
    setItems(payload.items);
  }, []);

  useEffect(() => {
    void loadNotifications();
    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  const handleRead = useCallback(async (notification: Notification) => {
    const response = await fetch(`/api/notifications/${notification.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (response.ok) {
      setItems((currentItems) => currentItems.filter((item) => item.id !== notification.id));
    }

    window.location.assign(
      `/resources/${notification.resourceId}#comment-${notification.commentId}`
    );
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setIsOpen((value) => !value)} type="button">
        Notifications {items.length > 0 ? `(${items.length})` : ""}
      </button>
      {isOpen ? (
        <div
          style={{
            background: "white",
            border: "1px solid #d0d7de",
            borderRadius: 8,
            marginTop: 8,
            minWidth: 280,
            position: "absolute",
            right: 0,
            zIndex: 10,
          }}
        >
          <NotificationList items={items} onRead={handleRead} />
        </div>
      ) : null}
    </div>
  );
}
