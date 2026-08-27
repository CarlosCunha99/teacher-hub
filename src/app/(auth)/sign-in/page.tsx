"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { signInAction, type SignInActionState } from "@/app/(auth)/sign-in/actions";

const initialState: SignInActionState = { ok: false };

export default function SignInPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(signInAction, initialState);

  useEffect(() => {
    if (state.ok) {
      router.push("/dashboard");
    }
  }, [router, state.ok]);

  return (
    <main>
      <h1>Sign in</h1>
      <form action={formAction}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />

        {state.error ? <p role="alert">{state.error}</p> : null}

        <button type="submit" disabled={isPending}>
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p>
        New here? <Link href="/register">Create an account</Link>
      </p>
    </main>
  );
}
