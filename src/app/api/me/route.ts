import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(): Promise<Response> {
  const session = await auth();

  if (!session?.user || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      id: (session.user as { id?: string }).id,
      email: session.user.email,
      name: session.user.name ?? null,
    },
    { status: 200 }
  );
}
