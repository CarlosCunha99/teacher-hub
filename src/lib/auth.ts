export type UserTier = "free" | "premium";

export interface SessionUser {
  id: string;
  tier: UserTier;
}

export interface Session {
  user: SessionUser;
}

export const NOT_IMPLEMENTED_ERROR = new Error(
  "Authentication is not implemented yet. Complete issue #2 prerequisites."
);

export async function getSession(_request: Request): Promise<Session | null> {
  // TODO: Implement authentication — see issue #2
  return null;
}
