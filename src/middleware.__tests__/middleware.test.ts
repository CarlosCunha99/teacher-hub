import { vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: <T extends (...args: unknown[]) => unknown>(handler: T): T => handler,
}));

import middleware, { config } from "@/middleware";
import { NextRequest, type NextResponse } from "next/server";

// With the vi.mock above, `auth` is a pass-through so `middleware` is a plain
// (req: NextRequest) => NextResponse function at runtime.
// TypeScript still infers the NextAuth-wrapped signature from the source, so we
// cast once here and use this alias throughout the tests.
const callMiddleware = middleware as unknown as (req: NextRequest) => Promise<NextResponse>;

describe("Middleware — functional tests", () => {
  it("Middleware blocks unauthenticated request to protected route", async () => {
    // Arrange: Request to protected route with no session
    const request = new NextRequest(new URL("http://localhost:3000/dashboard"));

    // Act: Invoke middleware
    const response = await callMiddleware(request);

    // Assert: Redirected to sign-in
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);

    const location = response.headers.get("location");
    expect(location).toBeDefined();
    expect(location).toContain("/sign-in");
  });

  it.skip("Middleware passes authenticated request through — requires e2e/integration setup", async () => {
    // This test requires a valid signed JWT session token from NextAuth.
    // Producing such a token in a test environment requires:
    // - AUTH_SECRET env var
    // - NextAuth's encode() function with proper configuration
    // - Full NextAuth runtime setup
    //
    // The test plan acknowledges AC6/AC7/AC8 may need e2e verification.
    // For MVP, we skip this and rely on manual testing or future e2e suite.
    // Arrange: Request with a valid session token cookie
    // const request = new NextRequest(new URL("http://localhost:3000/dashboard"));
    // request.cookies.set("authjs.session-token", validEncodedJWT);
    // Act: Invoke middleware
    // const response = await callMiddleware(request);
    // Assert: Passes through (not a redirect)
    // expect(response.status).not.toBeGreaterThanOrEqual(300);
  });

  it("Middleware leaves public and NextAuth routes unaffected", () => {
    // In production, the Next.js matcher excludes these paths entirely —
    // the middleware function is never invoked for them.
    // This test verifies the matcher correctly excludes each public path.
    const publicPaths = [
      "/api/health",
      "/api/auth/signin",
      "/api/auth/callback/credentials",
      "/register",
      "/sign-in",
      "/_next/static/test.js",
      "/favicon.ico",
    ];

    const matcher = config.matcher[0];
    // Anchor the regex so it tests the full path, not a substring.
    const matcherRegex = new RegExp("^" + matcher + "$");

    for (const path of publicPaths) {
      const matchedByMiddleware = matcherRegex.test(path);
      // Public paths must NOT be matched — Next.js excludes them before middleware runs.
      expect(matchedByMiddleware, `Expected "${path}" to be excluded by the matcher`).toBe(false);
    }
  });

  it("Middleware matcher pattern excludes public paths", () => {
    // Test the matcher configuration directly
    const matcher = config.matcher[0];

    // The matcher should be a regex pattern that excludes certain paths
    expect(matcher).toContain("api/health");
    expect(matcher).toContain("api/auth");
    expect(matcher).toContain("register");
    expect(matcher).toContain("sign-in");
    expect(matcher).toContain("_next/static");
    expect(matcher).toContain("favicon.ico");
  });
});
