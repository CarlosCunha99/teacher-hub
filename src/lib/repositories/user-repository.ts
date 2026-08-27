import { normalizeEmail } from "@/lib/auth/validation";

export interface TeacherAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<TeacherAccount | null>;
  create(input: { name: string; email: string; passwordHash: string }): Promise<TeacherAccount>;
}

export class InMemoryUserRepository implements IUserRepository {
  private readonly usersByEmail = new Map<string, TeacherAccount>();

  async findByEmail(email: string): Promise<TeacherAccount | null> {
    const normalizedEmail = normalizeEmail(email);
    return this.usersByEmail.get(normalizedEmail) ?? null;
  }

  async create(input: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<TeacherAccount> {
    const normalizedEmail = normalizeEmail(input.email);

    if (this.usersByEmail.has(normalizedEmail)) {
      throw new Error("email already in use");
    }

    const account: TeacherAccount = {
      id: globalThis.crypto.randomUUID(),
      name: input.name,
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      createdAt: new Date(),
    };

    this.usersByEmail.set(normalizedEmail, account);
    return account;
  }
}
