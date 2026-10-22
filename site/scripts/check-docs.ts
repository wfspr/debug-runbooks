import { auditDocumentation } from "../src/lib/documentation.ts";

const { files, issues } = auditDocumentation();
for (const issue of issues) console.error(`${issue.file}:${issue.line}: ${issue.rule} (content not shown)`);
console.log(`[check-docs] ${files.length} source files checked; ${issues.length} issue(s). Known credential formats and code-fence balance only.`);
if (issues.length) process.exitCode = 1;
