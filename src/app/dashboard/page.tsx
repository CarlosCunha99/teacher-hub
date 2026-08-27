import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Welcome, {session.user.name ?? session.user.email}.</p>
      <p>
        <Link href="/">Back to home</Link>
      </p>
    </main>
  );
}
