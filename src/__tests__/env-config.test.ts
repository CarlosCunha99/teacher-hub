import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const envExamplePath = path.join(repoRoot, ".env.example");

describe(".env.example", () => {
  it("exists and is non-empty", () => {
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const content = fs.readFileSync(envExamplePath, "utf-8");
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it("contains no real-looking secrets", () => {
    const content = fs.readFileSync(envExamplePath, "utf-8");

    expect(content).not.toMatch(/(password|secret|key)\s*=\s*[a-zA-Z0-9+\/]{16,}/i);
  });

  it("contains at least one variable key", () => {
    const content = fs.readFileSync(envExamplePath, "utf-8");

    expect(content).toMatch(/^[A-Z_]+=.*/m);
  });
});
