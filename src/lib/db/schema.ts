import { foreignKey, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "moderator", "admin"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "comment_on_resource",
  "reply_to_comment",
]);

export const usersTable = pgTable("users_stub", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
});

export const resourcesTable = pgTable("resources_stub", {
  id: uuid("id").primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => usersTable.id),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
});

export const commentsTable = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => usersTable.id),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { mode: "string", withTimezone: true }),
    deletedAt: timestamp("deleted_at", { mode: "string", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    commentsParentFk: foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "comments_parent_id_comments_id_fk",
    }),
    resourceParentCreatedIdx: index("comments_resource_parent_created_idx").on(
      table.resourceId,
      table.parentId,
      table.createdAt
    ),
    resourceDeletedIdx: index("comments_resource_deleted_idx").on(
      table.resourceId,
      table.deletedAt
    ),
  })
);

export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => usersTable.id),
    type: notificationTypeEnum("type").notNull(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => commentsTable.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { mode: "string", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    recipientReadCreatedIdx: index("notifications_recipient_read_created_idx").on(
      table.recipientId,
      table.readAt,
      table.createdAt
    ),
  })
);
