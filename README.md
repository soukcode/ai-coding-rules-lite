# AI Coding Rules Lite

A free sample of Souk Code's AI coding rules for Laravel and Next.js/TypeScript, plus the small validator that checks them. Six rules per file set, short and reviewable.

**What is here**

- `laravel/`: 6 rules (security and testing) as `CLAUDE.md`, `AGENTS.md` and two Cursor `.mdc` files.
- `nextjs-ts/`: 6 rules (auth and security, TypeScript strictness) in the same formats.
- `linter/rulecheck.mjs`: zero-dependency Node 22 validator for an installed rule set (frontmatter, file globs, rule IDs, declared conflicts, local references, file size). It previews before it copies anything.

**Use it**

```sh
# preview what would be copied into your project
node linter/rulecheck.mjs /path/to/project --fix-init --tool claude
# copy (never overwrites existing files)
node linter/rulecheck.mjs /path/to/project --fix-init --tool claude --write
# validate the installed rules
node linter/rulecheck.mjs /path/to/project
node --test linter/rulecheck.test.mjs
```

Use `--tool cursor` or `--tool codex` for those formats.

**Honest limits**

- File formats follow the official documentation of Claude Code, Cursor and Codex. These tools were not run against this sample.
- rulecheck checks structure, not meaning. It detects declared conflicts only. Passing does not prove the rules are effective or your code is safe.
- Needs Node 22+. The rules themselves are plain Markdown.

**The full pack**

The full pack has 48 rules (24 per stack, eight Cursor rule files per stack), six optional Claude Code skills, four review checklists, 44 prompt templates and 85 validator tests: https://soukcode.gumroad.com/l/ai-coding-rules-laravel-nextjs

MIT licence for this repository. Tool names only identify file formats and imply no affiliation.
