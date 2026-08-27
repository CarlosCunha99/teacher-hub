/**
 * Authentication seam.
 *
 * TODO(issue #2): implement real session resolution (cookie/JWT parsing).
 * Until then this returns `null`, so every protected billing route responds
 * with `401`. Billing code depends only on this signature and can be wired to
 * the real implementation without further changes.
 */
export async function getSessionUserId(_request: Request): Promise<string | null> {
  return null;
}
