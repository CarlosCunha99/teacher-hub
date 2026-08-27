import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const readmePath = path.join(repoRoot, "README.md");

describe("README.md", () => {
  it("exists", () => {
    expect(fs.existsSync(readmePath)).toBe(true);
  });

  it("documents npm install", () => {
    const content = fs.readFileSync(readmePath, "utf-8");
    expect(content).toMatch(/npm install/i);
  });

  it("documents npm run dev or npm start", () => {
    const content = fs.readFileSync(readmePath, "utf-8");
    expect(content).toMatch(/npm run dev|npm start/i);
  });

  it("documents folder/architecture", () => {
    const content = fs.readFileSync(readmePath, "utf-8");
    expect(content).toMatch(/src\/app|folder structure|architecture/i);
  });

  it("documents env config", () => {
    const content = fs.readFileSync(readmePath, "utf-8");
    expect(content).toMatch(/\.env|environment variable/i);
  });
});
