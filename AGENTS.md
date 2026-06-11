# Repository Guidelines

## Project Structure & Module Organization

This repository is a Node.js 18+ TypeScript CLI installer for the `jp-trade-stats` agent skill. Main CLI source lives in `src/cli.ts`; builds are emitted to `dist/` by `tsup`. The installable skill payload is under `template/`, including `.agent/skills/jp-trade-stats/` plus proxy `SKILL.md` files for Claude, Codex, and Gemini. Reference docs and runnable skill scripts are in `template/.agent/skills/jp-trade-stats/references/` and `scripts/`. `sample/generate-web-assets/` is a separate sample consumer project; avoid changing it unless validating installed output.

## Build, Test, and Development Commands

- `npm install`: install development dependencies from `package-lock.json`.
- `npm run build`: bundle `src/cli.ts` to `dist/cli.js` as an ESM Node 18 executable.
- `node dist/cli.js --help`: smoke-test the built CLI help output.
- `node dist/cli.js init --dir /tmp/jp-trade-stats-check`: verify template installation behavior in a scratch directory.
- `node dist/cli.js doctor --dir /tmp/jp-trade-stats-check`: confirm all expected template files were copied.

There is currently no `npm test` script; use the build and CLI smoke checks above for verification.

## Coding Style & Naming Conventions

Use TypeScript with strict compiler settings from `tsconfig.json`. Keep modules ESM-only, use Node built-in imports with the `node:` prefix, and prefer async `fs/promises` APIs. Match the existing two-space indentation, double quotes, semicolons, and concise helper functions. CLI command names and options are lowercase kebab style, for example `init`, `doctor`, `--dir`, and `--force`.

## Testing Guidelines

When changing CLI behavior, test the affected command against a temporary directory and inspect copied paths rather than modifying the repository root. When changing files under `template/`, run `build`, then `init`, then `doctor` so the packaged template traversal is exercised. If adding automated tests later, keep them focused on option parsing, overwrite behavior, missing-file detection, and template path preservation.

## Commit & Pull Request Guidelines

Recent commits use short, direct Japanese summaries, for example `apiキーについての説明を追加`. Keep commits focused on one logical change and use an imperative or descriptive subject. Pull requests should include the intent, changed areas (`src/`, `template/`, docs, or sample), verification commands run, and any user-facing CLI output changes. Link related issues when applicable and include screenshots only for changes to generated visual assets in the sample project.

## Security & Configuration Tips

Do not commit real e-Stat application IDs or generated local skill installs. Document `ESTAT_APP_ID` usage in docs or templates, but keep secrets in the user environment.
