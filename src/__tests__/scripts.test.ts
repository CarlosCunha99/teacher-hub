import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");

describe("npm scripts", () => {
  it("npm run lint exits 0", () => {
    const result = spawnSync("npm", ["run", "lint"], {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: 30_000,
    });

    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }

    expect(result.status).toBe(0);
  }, 30_000);

  it("npm run format:check exits 0", () => {
    const result = spawnSync("npm", ["run", "format:check"], {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: 30_000,
    });

    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }

    expect(result.status).toBe(0);
  }, 30_000);

  it("npm run build exits 0 and produces .next/", () => {
    const result = spawnSync("npm", ["run", "build"], {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: 120_000,
    });

    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }

    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(repoRoot, ".next"))).toBe(true);
  }, 120_000);
});
