# CLAUDE.md

n8n community node package `@onlyoffice/n8n-nodes-docs`: one node, **ONLYOFFICE Docs**, with the resources
Conversion and Document Builder, and one credential, `onlyofficeDocsApi`. Requires ONLYOFFICE Docs 10.0+.

Load the skills before working: `onlyoffice-n8n-docs` (repo map, JWT, Conversion), `onlyoffice-n8n-docbuilder`
(Document Builder scripts) and `onlyoffice-n8n-docs-development` (n8n API, lint, tests, review). Use the `release`
skill to cut a release. Background and history are in `HANDOVER.md`.

## Commands

```bash
pnpm install --frozen-lockfile   # Node 24.13.0 / pnpm 10.28.1 from mise.toml; never pnpm 12
pnpm build                       # -> dist/
pnpm lint                        # n8n-node lint (strict); must exit 0
pnpm test                        # unit tests, offline, seconds
bash test/docker.sh              # unit + automation in Docker against a Document Server 10, 15-20 min
```

Run `bash test/docker.sh` only after the user confirms: it starts containers.

## Layout

- `nodes/OnlyofficeDocs/OnlyofficeDocs.node.ts`: description, credential test, `execute` (Conversion).
- `nodes/OnlyofficeDocs/GenericFunctions.ts`: JWT, multipart, polling, Document Builder execution.
- `nodes/OnlyofficeDocs/scripts.ts`: Document Builder script templates (ES5).
- `nodes/OnlyofficeDocs/document-formats/`: vendored ONLYOFFICE/document-formats. Replace the whole folder and never edit it by hand.
- `credentials/OnlyofficeDocsApi.credentials.ts`: `docsServerUrl`, `jwtSecret`, `jwtHeader`.
- `test/unit`, `test/automation` (one workflow per operation), `test/run.sh`, `test/docker.sh`.

## Rules

- Never rename parameter `name`s, operation `value`s, credential fields or output keys, and never change a default
  on the existing node version. Saved user workflows depend on them.
- User input enters Document Builder scripts only through `buildScript` with `escapeJs` / `toJsonLiteral`.
- Every request token carries the `operation` claim of its endpoint (`converter`, `docbuilder`, `command`).
- No runtime `dependencies`, no lifecycle scripts, no edits to `eslint.config.mjs`. Lint disables are inline with `-- reason`.
- A bug fix comes with a unit test that fails without it. Add user-visible changes to `CHANGELOG.md` under
  `[Unreleased]` and to `README.md`.
- Prettier: tabs, single quotes, width 100. Format only the files you touched.
- Branch from `develop` as `feat/…`, `fix/…`, `chore/…` and open PRs to `develop` (Gitea). Commits use lower-case
  Conventional Commits with no `Co-Authored-By` trailer. Push, open PRs and bump `version` only when the user asks.
