import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditDocumentation, checkDocumentationText } from "../src/lib/documentation.ts";

describe("raw documentation guard", () => {
  it("reports credential locations without returning credential values", () => {
    const key = "ghp_" + "A".repeat(36);
    const issues = checkDocumentationText("artifacts/auth.json", `{}\n{"token":"${key}"}`);
    expect(issues).toEqual([{ file: "artifacts/auth.json", line: 2, rule: "github token" }]);
    expect(JSON.stringify(issues)).not.toContain(key);
  });

  it("accepts placeholders and balanced nested fences", () => {
    expect(checkDocumentationText("guide.md", "````md\n```bash\necho '<API_KEY>'\n```\n````\n")).toEqual([]);
  });

  it("identifies the opening line of an unclosed fence", () => {
    expect(checkDocumentationText("guide.md", "# Guide\n\n```bash\necho ok\n")).toEqual([
      { file: "guide.md", line: 3, rule: "unclosed code fence" },
    ]);
  });

  it("checks raw Markdown and nested example artifacts independently of publication policy", () => {
    const root = mkdtempSync(join(tmpdir(), "runbook-docs-"));
    try {
      for (const dir of ["macos", "artifacts/examples", "site/dist", "backups"]) mkdirSync(join(root, dir), { recursive: true });
      const fakeKey = "gsk_" + "0".repeat(32);
      writeFileSync(join(root, "README.md"), "# Readme\n");
      writeFileSync(join(root, "macos/private.md"), fakeKey);
      writeFileSync(join(root, "artifacts/examples/auth.toml"), fakeKey);
      writeFileSync(join(root, "site/dist/output.md"), fakeKey);
      writeFileSync(join(root, "backups/local.md"), fakeKey);
      const result = auditDocumentation(root);
      expect(result.files).toEqual(["README.md", "artifacts/examples/auth.toml", "macos/private.md"]);
      expect(result.issues.map((issue) => issue.file)).toEqual(["artifacts/examples/auth.toml", "macos/private.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("finds no known-format secrets or unclosed fences in repository documentation", () => {
    const result = auditDocumentation();
    expect(result.files).toContain("artifacts/2026-08-23-multi-provider-setup/pi-auth.json");
    expect(result.files).toContain("CONTRIBUTING.md");
    expect(result.issues).toEqual([]);
  });

  it("refuses symlinked documentation instead of reading outside the source tree", () => {
    const root = mkdtempSync(join(tmpdir(), "runbook-docs-link-"));
    try {
      writeFileSync(join(root, "target.md"), "# Target\n");
      symlinkSync("target.md", join(root, "README.md"));
      expect(() => auditDocumentation(root)).toThrow("Documentation symlink requires review: README.md");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
