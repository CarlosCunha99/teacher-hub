import { spawnSync } from "child_process";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");

describe("TypeScript compilation", () => {
  it("tsc --noEmit exits 0", () => {
    const result = spawnSync("npx", ["tsc", "--noEmit"], {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: 60_000,
    });

    if (result.status !== 0) {
      // Surface the compiler output to aid debugging on failure.
      console.error(result.stdout);
      console.error(result.stderr);
    }

    expect(result.status).toBe(0);
  });
});
