---
name: onlyoffice-n8n-docs-development
description:
  Development rules for the @onlyoffice/n8n-nodes-docs package - n8n node API conventions used here, the strict
  n8n-node lint rules, code style, build/lint, running the node in a local n8n with hot reload against a Document
  Server, CI/release, and the review checklist with report format. Use for any TypeScript change in nodes/ or
  credentials/, for verifying a change, and for reviews.
---

# Docs package development

Scaffold: `@n8n/node-cli` `0.32.1` (`n8n-node build` / `n8n-node lint`), `n8n.strict: true`, `n8n-workflow` as the only
peer dependency, no runtime dependencies, **no automated tests**. Types: `node_modules/n8n-workflow/dist/...Interfaces.d.ts`
— read them instead of guessing field names.

## Node API conventions

- Programmatic node (`execute`), `resource` + `operation` options with `noDataExpression: true`; each operation option
  has `name` (Title Case), `value` (camelCase), `action` (sentence — also the AI tool prompt, `usableAsTool: true`).
- Every parameter has `displayOptions.show: { resource: [...], operation: [...] }`. Never rename a parameter `name`,
  operation `value` or credential property (`docsServerUrl`, `jwtSecret`, `jwtHeader`), and never change a
  type/default on the existing node version — saved workflows break. Breaking changes need `version: [1, 2]` +
  `@version` display conditions.
- Options sorted alphabetically by `name`; booleans described "Whether …"; `loadOptionsMethod` parameters named
  "… Name or ID" with the standard expression hint; `loadOptionsDependsOn` for every parameter the method reads.
  Secrets: `typeOptions: { password: true }`.
- Per item: `getNodeParameter(name, i)`, `getCredentials('onlyofficeDocsApi', i)`, output items carry `pairedItem`,
  `continueOnFail()` → `{ json: { error } }`, otherwise throw with `{ itemIndex: i }`.
- Errors: `NodeApiError(this.getNode(), error as JsonObject, { itemIndex })` for HTTP failures (keeps status/body);
  `NodeOperationError` for validation and Document Server error codes.
- HTTP: `this.helpers.httpRequest` — the credential has no `authenticate` because the JWT depends on the body, so
  every such call carries
  `// eslint-disable-next-line @n8n/community-nodes/no-http-request-with-manual-auth -- <reason>`. Every disable
  needs a `-- reason`. The credential test can only use `this.helpers.request` (disable with reason).
- Binary: input via `getBinaryDataBuffer(i, field)` (never `binary[field].data`), output via
  `prepareBinaryData(buffer, fileName)`. Waiting: `sleep` from `n8n-workflow`.

## Strict lint (n8n-node lint)

- Allowed imports: `n8n-workflow`, `lodash`, `moment`, `p-limit`, `luxon`, `zod`, `crypto`/`node:crypto`, relative
  files. Forbidden globals: `setTimeout`, `setInterval`, `setImmediate`, `process`, `global(This)`, `__dirname`,
  `__filename`. `Buffer` is fine. No `console.*`.
- `package.json`: no `dependencies`, no lifecycle scripts, no `overrides`; `peerDependencies` exactly
  `{ "n8n-workflow": "*" }`. New dev-dependency licenses that are not MIT-compatible → `.check-licenses.yml`.
- Strict mode checks that `eslint.config.mjs` is the unchanged default — never edit it.
- `pnpm exec n8n-node lint --fix` autofixes some rules. Lint is currently clean: any new warning is a finding.

## Code style

Prettier: tabs, single quotes, semicolons, trailing commas, width 100; run `pnpm exec prettier --write <touched
files>` (not `pnpm format`). Description sections separated by `/* ---- <resource>:<operation> ---- */` banners;
helpers get a one-line JSDoc; `import type` for types; no copyright headers in `.ts`; strict `tsconfig`, target
`es2019`. DocBuilder templates in `scripts.ts` are ES5 (`var`). Simple English.

## Build and verify

```bash
pnpm install --frozen-lockfile   # when node_modules is missing or the lockfile changed
pnpm build                       # -> dist/ (tsc + copies svg/json)
pnpm lint                        # must exit 0
```

`mise.toml` pins Node 24.13.0 / pnpm 10.28.1 (Node 22 also builds). Not pnpm 12 (creates `pnpm-workspace.yaml`, fails
with `ERR_PNPM_IGNORED_BUILDS`). Not `pnpm dev` (separate n8n instance with a scoped link, no hot reload).

The agent itself only builds and lints. Starting n8n, changing its setup and sending any request to a Document
Server happen only after the user confirms. Manual run in the user's WSL n8n:

- The repo is linked **unscoped** into `~/.n8n/custom/node_modules/onlyoffice-n8n` (a scoped `@onlyoffice/...` link
  is not watched). The WSL copy of the repo is separate from the Windows one — sync edits.
- n8n runs with `N8N_DEV_RELOAD=true`, `NODE_ENV=development`, `N8N_SECURE_COOKIE=false` plus `pnpm exec tsc --watch`
  in the repo. Log `Hot reload triggered for CUSTOM` = reloaded; description changes may need a page refresh,
  svg/json changes a restart. Node type: `CUSTOM.onlyofficeDocs` (+ `CUSTOM.onlyofficeDocsTool`).
- The Document Server must reach file URLs (use the WSL IP `hostname -I`, not localhost) and n8n must reach the DS
  public host for downloads.
- Check per touched operation: URL and binary source, File Data and URL Only, one error case with and without
  "Continue On Fail", two input items. Open the result file — a non-empty binary is not enough.

Report in the PR which operations were run manually and against which Docs version.

## CI and release (Gitea Actions at git.onlyoffice.com, mirrored to GitHub)

- `audit.yml` (push/PR to `master`, `develop`): frozen install, check-licenses, build, lint.
- `artifact.yml` (push to `develop` touching `credentials/`, `nodes/`, `package.json`): `pnpm pack` tarball.
- `master` push changing `package.json` → `create-tag.yml` tags `v<version>` → `release.yml` publishes to npm with
  provenance and creates a GitHub release. Never bump `version` unless the user asks for a release.
- `CHANGELOG.md` is Keep a Changelog: entries under `## [Unreleased]` → `### Added / Changed / Fixed`.

## Branches, commits, PRs

- Work branches from `develop`, named `<type>/<short-name>` (`feat/…`, `fix/…`, `chore/…`); PRs target `develop` in
  Gitea. `master` changes only through a release.
- Commit messages: Conventional Commits in lower case (`feat: …`, `fix: …`, `chore: …`). No
  `Co-Authored-By: Claude` trailer.
- The agent works locally only: commit to the work branch when asked; push and PR only after the user confirms;
  never commit to `develop` or `master` directly.

## Review checklist

1. Correctness: Conversion/DocBuilder fields match the API docs; body fields added before `signJwt`; optional
   collection fields sent only when set, falsy-but-valid values (`0`, `false`, `00`) kept; all four conversion paths
   (URL/binary × File Data/URL Only) still work.
2. Script safety: user data enters DocBuilder scripts only through `escapeJs` / `toJsonLiteral`.
3. Items: one output per input (or documented), `pairedItem`, `continueOnFail`, `itemIndex` on errors.
4. Security: no secrets in parameters, output JSON (e.g. Remove Password `password`), error messages; no new outbound
   hosts besides `docsServerUrl` and DS-returned URLs.
5. Compatibility: no renamed/removed parameter names, operation values, credential fields, output keys, default
   binary field.
6. Lint/build clean, `eslint.config.mjs` untouched, lockfile in sync, `version` untouched; CHANGELOG and README
   updated for user-visible changes.

Report format:

```markdown
## Findings
- Blocker: `path:line` - issue, why it matters, minimal fix.
- Should fix: `path:line` - risk, suggested fix.
- Nit: `path:line` - style.
## Checks run
- lint, build, manual runs, requests sent.
## Not verified
- e.g. no Document Server available.
## Summary
- One or two sentences.
```
