"use server";

import { AUTH_ERRORS } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import { normalizeEmail, validateRegistrationInput } from "@/lib/auth/validation";
import { signIn, userRepository } from "@/auth";

export interface RegisterActionState {
  ok: boolean;
  error?: string;
  field?: string;
}

export async function registerAction(
  _prevState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const validation = validateRegistrationInput({ name, email, password });

  if (!validation.ok) {
    return { ok: false, error: validation.message, field: validation.field };
  }

  const normalizedEmail = normalizeEmail(email);

  try {
    const existingUser = await userRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      return { ok: false, error: AUTH_ERRORS.EMAIL_IN_USE, field: "email" };
    }

    const passwordHash = await hashPassword(password);

    await userRepository.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirect: false,
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && /email already in use/i.test(error.message)) {
      return { ok: false, error: AUTH_ERRORS.EMAIL_IN_USE, field: "email" };
    }

    return { ok: false, error: AUTH_ERRORS.VALIDATION_ERROR, field: "form" };
  }
}
