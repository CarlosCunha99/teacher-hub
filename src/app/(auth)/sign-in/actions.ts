"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { AUTH_ERRORS } from "@/lib/auth/errors";
import { normalizeEmail, validateSignInInput } from "@/lib/auth/validation";

export interface SignInActionState {
  ok: boolean;
  error?: string;
  field?: string;
}

export async function signInAction(
  _prevState: SignInActionState,
  formData: FormData
): Promise<SignInActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const validation = validateSignInInput({ email, password });

  if (!validation.ok) {
    return { ok: false, error: validation.message, field: validation.field };
  }

  try {
    const result = await signIn("credentials", {
      email: normalizeEmail(email),
      password,
      redirect: false,
    });

    if (!result || result.error) {
      return { ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS, field: "form" };
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError && error.type === "CredentialsSignin") {
      return { ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS, field: "form" };
    }

    return { ok: false, error: AUTH_ERRORS.VALIDATION_ERROR, field: "form" };
  }
}
