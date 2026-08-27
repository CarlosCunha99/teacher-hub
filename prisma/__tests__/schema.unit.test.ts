import fs from "fs";
import path from "path";
import { Prisma } from "@prisma/client";

const repoRoot = path.resolve(__dirname, "../..");
const schemaPath = path.join(repoRoot, "prisma", "schema.prisma");
const schemaText = fs.readFileSync(schemaPath, "utf-8");

type DmmfModel = (typeof Prisma.dmmf.datamodel.models)[number];

const models = Prisma.dmmf.datamodel.models;
const modelNames = models.map((m) => m.name);

function getModel(name: string): DmmfModel {
  const model = models.find((m) => m.name === name);
  if (!model) {
    throw new Error(`Expected model "${name}" not found in Prisma DMMF datamodel`);
  }
  return model;
}

function fieldNames(model: DmmfModel): string[] {
  return model.fields.map((f) => f.name);
}

function isFieldRequired(model: DmmfModel, name: string): boolean {
  const field = model.fields.find((f) => f.name === name);
  if (!field) {
    throw new Error(`Expected field "${name}" not found on model "${model.name}"`);
  }
  return field.isRequired;
}

/** Extracts the raw text of a `model Name { ... }` block for textual assertions
 * that DMMF does not reliably expose (plain `@@index`, `onDelete` attributes). */
function extractModelBlock(name: string): string {
  const match = schemaText.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  if (!match) {
    throw new Error(`Could not locate "model ${name} { ... }" block in schema.prisma`);
  }
  return match[1];
}

const EXPECTED_MODELS = [
  "Teacher",
  "Identity",
  "Resource",
  "Subject",
  "YearLevel",
  "ResourceSubject",
  "ResourceYearLevel",
  "Board",
  "BoardItem",
  "Like",
];

describe("prisma/schema.prisma — entities and relationships", () => {
  it.each(EXPECTED_MODELS)("declares model %s", (name) => {
    expect(modelNames).toContain(name);
  });

  it("declares exactly the 10 documented models (no drift)", () => {
    expect([...modelNames].sort()).toEqual([...EXPECTED_MODELS].sort());
  });

  it("declares no unexpected 'Save'-like or out-of-scope models", () => {
    expect(modelNames).not.toEqual(expect.arrayContaining(["Save"]));
    expect(modelNames).not.toEqual(expect.arrayContaining(["Bookmark"]));
    expect(modelNames).not.toEqual(expect.arrayContaining(["SavedResource"]));
    expect(modelNames).not.toEqual(expect.arrayContaining(["Download"]));
    expect(modelNames).not.toEqual(expect.arrayContaining(["Downloads"]));
    expect(modelNames).not.toEqual(expect.arrayContaining(["TermsAcceptance"]));
  });
});

describe("Teacher model", () => {
  const teacher = getModel("Teacher");
  const names = fieldNames(teacher);

  it("has no password/credential field", () => {
    expect(names.some((n) => /password/i.test(n))).toBe(false);
  });

  it("has profile attributes: displayName, bio, createdAt", () => {
    expect(names).toContain("displayName");
    expect(names).toContain("bio");
    expect(names).toContain("createdAt");
  });

  it("has a unique email field", () => {
    expect(names).toContain("email");
    expect(teacher.fields.find((f) => f.name === "email")?.isUnique).toBe(true);
  });
});

describe("Identity model — linked OAuth identity providers", () => {
  const identity = getModel("Identity");
  const names = fieldNames(identity);

  it("has provider, providerAccountId, and a teacher relation", () => {
    expect(names).toEqual(
      expect.arrayContaining(["provider", "providerAccountId", "teacherId", "teacher"])
    );
  });

  it("has a unique compound constraint on (provider, providerAccountId)", () => {
    const hasCompoundUnique = identity.uniqueIndexes.some((idx) => {
      const fields = [...idx.fields].sort();
      return fields.length === 2 && fields[0] === "provider" && fields[1] === "providerAccountId";
    });
    expect(hasCompoundUnique).toBe(true);
  });

  it("requires teacherId (NOT NULL foreign key)", () => {
    expect(isFieldRequired(identity, "teacherId")).toBe(true);
  });
});

describe("Resource model — core fields", () => {
  const resource = getModel("Resource");
  const names = fieldNames(resource);

  it("has title, description, ownerId, fileUrl, status, createdAt", () => {
    expect(names).toEqual(
      expect.arrayContaining(["title", "description", "ownerId", "fileUrl", "status", "createdAt"])
    );
  });

  it("requires ownerId (NOT NULL foreign key)", () => {
    expect(isFieldRequired(resource, "ownerId")).toBe(true);
  });

  it("has a nullable deletedAt soft-delete marker", () => {
    const deletedAt = resource.fields.find((f) => f.name === "deletedAt");
    expect(deletedAt).toBeDefined();
    expect(deletedAt?.isRequired).toBe(false);
  });

  it("does not have a direct subjectId or yearLevelId scalar column", () => {
    expect(names).not.toContain("subjectId");
    expect(names).not.toContain("yearLevelId");
  });
});

describe("Resource–Subject and Resource–YearLevel are many-to-many via join models", () => {
  it("ResourceSubject has resourceId and subjectId foreign keys", () => {
    const join = getModel("ResourceSubject");
    expect(fieldNames(join)).toEqual(expect.arrayContaining(["resourceId", "subjectId"]));
    expect(isFieldRequired(join, "resourceId")).toBe(true);
    expect(isFieldRequired(join, "subjectId")).toBe(true);
  });

  it("ResourceYearLevel has resourceId and yearLevelId foreign keys", () => {
    const join = getModel("ResourceYearLevel");
    expect(fieldNames(join)).toEqual(expect.arrayContaining(["resourceId", "yearLevelId"]));
    expect(isFieldRequired(join, "resourceId")).toBe(true);
    expect(isFieldRequired(join, "yearLevelId")).toBe(true);
  });
});

describe("Board model", () => {
  const board = getModel("Board");

  it("carries a visibility attribute with a non-null default", () => {
    const visibility = board.fields.find((f) => f.name === "visibility");
    expect(visibility).toBeDefined();
    expect(visibility?.hasDefaultValue).toBe(true);
  });

  it("requires ownerId (NOT NULL foreign key)", () => {
    expect(isFieldRequired(board, "ownerId")).toBe(true);
  });
});

describe("BoardItem model — saved resources", () => {
  const boardItem = getModel("BoardItem");

  it("has a createdAt field for 'most recent saves' ordering", () => {
    expect(fieldNames(boardItem)).toContain("createdAt");
  });

  it("requires boardId and resourceId (NOT NULL foreign keys)", () => {
    expect(isFieldRequired(boardItem, "boardId")).toBe(true);
    expect(isFieldRequired(boardItem, "resourceId")).toBe(true);
  });

  it("has a compound primary key on (boardId, resourceId) preventing duplicate saves", () => {
    const pk = boardItem.primaryKey;
    expect(pk).toBeTruthy();
    expect([...(pk?.fields ?? [])].sort()).toEqual(["boardId", "resourceId"].sort());
  });
});

describe("Like model", () => {
  const like = getModel("Like");

  it("requires teacherId and resourceId (NOT NULL foreign keys)", () => {
    expect(isFieldRequired(like, "teacherId")).toBe(true);
    expect(isFieldRequired(like, "resourceId")).toBe(true);
  });

  it("has a compound primary key on (teacherId, resourceId) preventing duplicate likes", () => {
    const pk = like.primaryKey;
    expect(pk).toBeTruthy();
    expect([...(pk?.fields ?? [])].sort()).toEqual(["resourceId", "teacherId"].sort());
  });
});

describe("Indexes on documented access patterns (textual — @@index is not exposed via DMMF)", () => {
  it("Resource has an index covering (ownerId, createdAt) for feed ordering", () => {
    const block = extractModelBlock("Resource");
    expect(block).toMatch(/@@index\(\[\s*ownerId\s*,\s*createdAt\s*\]\)/);
  });

  it("Resource has an index supporting discovery/filtering queries", () => {
    const block = extractModelBlock("Resource");
    expect(block).toMatch(/@@index\(\[[^\]]*createdAt[^\]]*\]\)/);
  });

  it("ResourceSubject and ResourceYearLevel are indexed for join lookups", () => {
    expect(extractModelBlock("ResourceSubject")).toMatch(/@@index\(\[[^\]]*subjectId[^\]]*\]\)/);
    expect(extractModelBlock("ResourceYearLevel")).toMatch(
      /@@index\(\[[^\]]*yearLevelId[^\]]*\]\)/
    );
  });
});

describe("Deletion behavior matches documented semantics", () => {
  it("Resource.deletedAt exists (soft-delete marker) — see also 'Resource model' block above", () => {
    const resource = getModel("Resource");
    expect(resource.fields.some((f) => f.name === "deletedAt")).toBe(true);
  });

  it("Like relations to Resource and Teacher cascade on delete", () => {
    const block = extractModelBlock("Like");
    expect(block).toMatch(/resource\s+Resource\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(block).toMatch(/teacher\s+Teacher\s+@relation\([^)]*onDelete:\s*Cascade/);
  });

  it("BoardItem relations to Board and Resource cascade on delete", () => {
    const block = extractModelBlock("BoardItem");
    expect(block).toMatch(/board\s+Board\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(block).toMatch(/resource\s+Resource\s+@relation\([^)]*onDelete:\s*Cascade/);
  });

  it("Resource-to-Teacher (owner) and Board-to-Teacher (owner) relations cascade on delete", () => {
    expect(extractModelBlock("Resource")).toMatch(
      /owner\s+Teacher\s+@relation\([^)]*onDelete:\s*Cascade/
    );
    expect(extractModelBlock("Board")).toMatch(
      /owner\s+Teacher\s+@relation\([^)]*onDelete:\s*Cascade/
    );
  });

  it("Taxonomy join relations to Subject/YearLevel are NOT cascade (restrict deletion while referenced)", () => {
    expect(extractModelBlock("ResourceSubject")).toMatch(
      /subject\s+Subject\s+@relation\([^)]*onDelete:\s*Restrict/
    );
    expect(extractModelBlock("ResourceYearLevel")).toMatch(
      /yearLevel\s+YearLevel\s+@relation\([^)]*onDelete:\s*Restrict/
    );
  });
});

describe("package.json — Prisma developer workflow scripts", () => {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  it("declares prisma:generate, db:migrate, db:migrate:deploy, db:seed, db:reset scripts", () => {
    expect(packageJson.scripts).toMatchObject({
      "prisma:generate": expect.stringContaining("prisma generate"),
      "db:migrate": expect.stringContaining("prisma migrate dev"),
      "db:migrate:deploy": expect.stringContaining("prisma migrate deploy"),
      "db:seed": expect.stringContaining("prisma db seed"),
      "db:reset": expect.stringContaining("prisma migrate reset"),
    });
  });

  it("declares a postinstall script that regenerates the Prisma client", () => {
    expect(packageJson.scripts.postinstall).toEqual(expect.stringContaining("prisma generate"));
  });

  it("preserves the pre-existing dev/build/start/lint/format/test scripts", () => {
    expect(packageJson.scripts).toMatchObject({
      dev: expect.any(String),
      build: expect.any(String),
      start: expect.any(String),
      lint: expect.any(String),
      format: expect.any(String),
      "format:check": expect.any(String),
      test: expect.any(String),
    });
  });

  it("declares a top-level prisma.seed config pointing at prisma/seed.ts", () => {
    expect(packageJson.prisma?.seed).toEqual(expect.stringContaining("prisma/seed.ts"));
  });

  it("declares @prisma/client as a dependency and prisma/tsx as devDependencies", () => {
    expect(packageJson.dependencies).toHaveProperty("@prisma/client");
    expect(packageJson.devDependencies).toHaveProperty("prisma");
    expect(packageJson.devDependencies).toHaveProperty("tsx");
  });
});

describe("docs/DATABASE.md — DAL guide", () => {
  const docsPath = path.join(repoRoot, "docs", "DATABASE.md");

  it("exists and is non-empty", () => {
    expect(fs.existsSync(docsPath)).toBe(true);
    expect(fs.readFileSync(docsPath, "utf-8").trim().length).toBeGreaterThan(0);
  });

  it("mentions every entity name", () => {
    const content = fs.readFileSync(docsPath, "utf-8");
    for (const name of EXPECTED_MODELS) {
      expect(content).toMatch(new RegExp(name));
    }
  });

  it("documents soft-delete semantics on resources", () => {
    const content = fs.readFileSync(docsPath, "utf-8").toLowerCase();
    expect(content).toMatch(/soft-delete|soft delete|deletedat/);
  });

  it("documents cascade delete semantics for likes/board items", () => {
    const content = fs.readFileSync(docsPath, "utf-8").toLowerCase();
    expect(content).toMatch(/cascade/);
  });

  it("documents the canonical @/lib/db import convention", () => {
    const content = fs.readFileSync(docsPath, "utf-8");
    expect(content).toMatch(/@\/lib\/db/);
  });
});
