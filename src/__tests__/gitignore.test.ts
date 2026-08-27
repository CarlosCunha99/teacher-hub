import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const gitignoreContent = fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf-8");

describe(".gitignore", () => {
  it("ignores node_modules", () => {
    expect(gitignoreContent).toMatch(/node_modules\/?/);
  });

  it("ignores .next", () => {
    expect(gitignoreContent).toMatch(/\.next\/?/);
  });

  it("ignores .env*.local", () => {
    expect(gitignoreContent).toMatch(/\.env\*?\.local/);
  });

  it("ignores coverage", () => {
    expect(gitignoreContent).toMatch(/coverage\/?/);
  });
});
