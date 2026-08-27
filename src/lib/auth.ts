export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
}

const MOCK_USERS: Record<string, AuthUser> = {
  "teacher-1": {
    id: "teacher-1",
    name: "Jane Smith",
    username: "jane-smith",
    email: "jane@example.com",
  },
  "teacher-2": {
    id: "teacher-2",
    name: "John Doe",
    username: "john-doe",
    email: "john@example.com",
  },
  "teacher-3": {
    id: "teacher-3",
    name: "Sarah Johnson",
    username: "sarah-johnson",
    email: "sarah@example.com",
  },
};

let currentUserId = "teacher-1";

export function getCurrentUser(): AuthUser | null {
  return MOCK_USERS[currentUserId] || null;
}

export function setCurrentUser(userId: string): void {
  if (MOCK_USERS[userId]) {
    currentUserId = userId;
  }
}

export function requireAuth(): AuthUser {
  const user = getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
