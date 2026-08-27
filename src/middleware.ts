import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth(function middleware(req: NextRequest) {
  const requestWithAuth = req as NextRequest & { auth?: unknown };

  if (!requestWithAuth.auth) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/health|api/auth|_next/static|_next/image|favicon.ico|register|sign-in).*)"],
};
