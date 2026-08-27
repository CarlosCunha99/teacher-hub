"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { registerAction, type RegisterActionState } from "@/app/(auth)/register/actions";

const initialState: RegisterActionState = { ok: false };

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  useEffect(() => {
    if (state.ok) {
      router.push("/dashboard");
    }
  }, [router, state.ok]);

  return (
    <main>
      <h1>Register</h1>
      <form action={formAction}>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" autoComplete="name" required />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required />

        {state.error ? <p role="alert">{state.error}</p> : null}

        <button type="submit" disabled={isPending}>
          {isPending ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p>
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </main>
  );
}
