import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main>
        <h1>Teacher Hub</h1>
        <p>Welcome! Please sign in or create an account.</p>
        <p>
          <Link href="/sign-in">Sign in</Link> · <Link href="/register">Register</Link>
        </p>
      </main>
    );
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <main>
      <h1>Teacher Hub</h1>
      <p>Signed in as {session.user.name ?? session.user.email}.</p>
      <p>
        <Link href="/dashboard">Go to dashboard</Link>
      </p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
