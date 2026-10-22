/** Raw-source checks, independent of the website's publication/redaction policy. */
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./paths.ts";
import { createFenceTracker } from "./sections.ts";
import { scanForSecrets } from "./secret-scan.ts";

export interface DocumentationIssue {
  file: string;
  line: number;
  rule: string;
}

/** Diagnostics contain locations and rule names only, never matched content. */
export function checkDocumentationText(file: string, content: string): DocumentationIssue[] {
  const issues = scanForSecrets(content).map(({ line, pattern }) => ({ file, line, rule: pattern }));
  if (file.endsWith(".md")) {
    const fence = createFenceTracker();
    let openingLine = 0;
    content.split("\n").forEach((line, i) => {
      const wasInside = fence.inside;
      fence.update(line);
      if (!wasInside && fence.inside) openingLine = i + 1;
    });
    if (fence.inside) issues.push({ file, line: openingLine, rule: "unclosed code fence" });
  }
  return issues;
}

export function auditDocumentation(root = REPO_ROOT): { files: string[]; issues: DocumentationIssue[] } {
  const files = readdirSync(root, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.name.endsWith(".md")) return false;
      if (entry.isSymbolicLink()) throw new Error(`Documentation symlink requires review: ${entry.name}`);
      return entry.isFile();
    })
    .map((entry) => entry.name);

  // Omit dependencies, generated site output, and local backups.
  // Do not consult content-policy.yaml: excluded/private sources still count.
  function walk(dir: string, artifacts = false): void {
    const absolute = join(root, dir);
    if (!existsSync(absolute)) return;
    if (lstatSync(absolute).isSymbolicLink()) throw new Error(`Documentation symlink requires review: ${dir}`);
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Documentation symlink requires review: ${file}`);
      if (entry.isDirectory()) walk(file, artifacts);
      else if (entry.isFile() && (file.endsWith(".md") || (artifacts && /\.(?:jsonc?|toml|ya?ml|txt|env(?:\.example)?)$/i.test(file)))) files.push(file);
    }
  }
  for (const dir of ["macos", "windows", "linux", "cross-platform", "docs", "templates"]) walk(dir);
  walk("artifacts", true);
  files.sort();
  return { files, issues: files.flatMap((file) => checkDocumentationText(file, readFileSync(join(root, file), "utf8"))) };
}
