# Handover: ONLYOFFICE Docs n8n nodes

State as of 2026-11-13. Published on npm: `@onlyoffice/n8n-nodes-docs` **0.0.2** (2026-07-10). `develop` holds a
large unreleased change set for ONLYOFFICE Docs 10 (see `CHANGELOG.md` `[Unreleased]`).

## 1. Integration type

- **A plugin inside the host**, not a separate service. The package is an n8n community node installed into n8n from npm
  (Settings → Community Nodes, or `npm install` in the n8n folder). The code runs inside the n8n process and makes
  HTTP calls to an ONLYOFFICE Document Server that the user names in the credential.
- **ONLYOFFICE product: Docs (Document Server)**, through these endpoints:
  - Conversion API: `POST /converter` for a URL input, with polling, and `POST /converter/from-file` for a binary
    input sent as multipart. The from-file endpoint returns the converted file itself.
  - Web Document Builder: `POST /docbuilder/from-file`. The node generates the script from the templates in
    `scripts.ts`, and the script opens input documents by URL.
  - Command Service: `POST /command` `{c: 'version'}`, used only by the credential test.
  - Authentication is a JWT (HS256) signed with the Document Server secret. Every token carries the `operation`
    claim that Docs 10 checks (`token.purposeCheck`). A Document Server without JWT is not supported.
- **Supported versions:** ONLYOFFICE Docs **10.0 or later**, because both from-file endpoints exist only from 10.0
  (README, `test/automation/setup.ts` refuses older servers). CI tests against
  `onlyoffice/documentserver-de:10.0` and n8n **2.40.7** (`test/run.sh`). The package uses n8n nodes API version 1 in
  `strict` mode.
- **Why this is a separate package from the DocSpace nodes:** they target different products with different access
  models. DocSpace is a portal with a REST API and user-level authentication (API key, OAuth2 and others). Docs is a
  Document Server that you reach by URL and a shared JWT secret, with no users or storage of its own. If both lived
  in one node, a user could pick a credential that does not fit the operation. Separate packages also let users install
  only the product they run and let each package be released on its own.

## 2. Main features

Conversion resource:

1. Convert a document between formats. The format lists come from the vendored `document-formats` JSON. The input is
   a URL or n8n binary data; the output is File Data or URL Only.
2. Convert to PDF, convert a spreadsheet to PDF with page setup, add a text watermark to a PDF.
3. Generate a thumbnail (PNG or JPG; the first page, or all pages as a zip).
4. Remove the password from a document.

Document Builder resource:

5. Extract: text, outline, tables (as `records` for later steps), chunks for RAG, metadata.
6. Generate: a document from text, Markdown to DOCX/PDF, JSON to a table, JSON to XLSX, JSON to PPTX.
7. Modify: fill a `{{key}}` template, mail merge (one document per record), append paragraphs, append or update
   spreadsheet rows.
8. Chaining: the `outputUrl` of one step is the input URL of the next step, and the `records` from Extract Tables
   feed the generators.

All operations can also be used as AI Agent tools (`usableAsTool`).

## 3. Build

- Toolchain from `mise.toml`: Node 24.13.0 and pnpm 10.28.1. Node 22 also builds. Do not use pnpm 12: it creates
  `pnpm-workspace.yaml` and fails with `ERR_PNPM_IGNORED_BUILDS`.
- `pnpm install --frozen-lockfile && pnpm build && pnpm lint && pnpm test`. The build tool is
  `@n8n/node-cli` 0.32.1.
- n8n strict mode forbids runtime dependencies (the only peer dependency is `n8n-workflow`), most globals, and any
  change to `eslint.config.mjs`. There are no private packages.
- To update `nodes/OnlyofficeDocs/document-formats/`, replace the whole folder with a copy of
  ONLYOFFICE/document-formats. It is not a submodule.
- Automation tests (`bash test/docker.sh`) need only Docker. They start a public Document Server image and run every
  workflow in `test/automation/workflows/` in a real n8n. Set `DS_IMAGE` to test another Docs version.

### Local n8n with hot reload

1. Install n8n globally (`npm i -g n8n@2.40.7`, Node 24), then run `pnpm install --frozen-lockfile && pnpm build` in
   the repo.
2. Link the repo **without the npm scope**: `ln -s <repo> ~/.n8n/custom/node_modules/onlyoffice-n8n`. n8n's watcher
   does not follow a link under `@onlyoffice/`, so `npm link` and `pnpm dev` give no hot reload.
3. Run `pnpm exec tsc --watch` in the repo and start n8n with
   `N8N_DEV_RELOAD=true NODE_ENV=development N8N_SECURE_COOKIE=false n8n start`.
4. The node appears as `CUSTOM.onlyofficeDocs`. When it reloads, the log prints `Hot reload triggered for CUSTOM`.
   Description changes may need a page refresh, and svg/json changes need a restart.
5. Run a Document Server 10 in Docker with `JWT_SECRET` set and `ALLOW_PRIVATE_IP_ADDRESS=true`. It must be able to
   download the input URLs, and n8n must be able to reach the result URLs that it returns. With n8n in WSL and the
   Document Server in Docker Desktop, use `host.docker.internal` on both sides.

## 4. Publishing

The package is published to **npm** only. The full procedure is in `.claude/skills/release/SKILL.md`.

How the pipeline is meant to work:

- The workflows run on Gitea Actions and also on the GitHub mirror (`github.com/ONLYOFFICE/onlyoffice-n8n`).
  **Publishing works only on GitHub.** npm Trusted Publishing (OIDC) and `--provenance` exist only on GitHub Actions,
  and `release.yml` has no npm token.
- When a push to `master` changes `package.json`, `create-tag.yml` creates the tag `v<version>`. The tag starts
  `release.yml`, which builds, runs `pnpm publish --provenance --access public` and creates a GitHub release with
  the `.tgz`.

What actually happened:

- **0.0.1** was published by hand from the `onlyoffice` npm account (no provenance).
- **0.0.2** was published by `release.yml` on GitHub from the tag `v0.0.2`, which pointed to a `develop` commit. The npm
  job succeeded, but the run was cancelled before the GitHub release step. As a result there is no GitHub release,
  and the tag no longer exists on either remote.
- **`master` in this repository has never held the code.** It contains only `.github/` and `LICENSE`, and its Audit
  runs fail. Merge `develop` into `master` once before the first release that goes through the normal pipeline (see
  section 6).

Rules:

- `create-tag.yml` runs only when `package.json` changes. A release PR without the version bump publishes nothing.
- npm does not accept the same version twice. If a publish fails after the upload, release the next patch version.
- After a release, merge `master` back into `develop`.

## 5. Implicit knowledge

- **The JWT is signed over the body before `token` is added.** The `operation` claim is `converter` (also used for
  polling and from-file), `docbuilder` or `command`. Do not use the server's internal purpose names
  (`converter-from-file`): Docs answers them with `-8`.
- **The credential test uses `/command`, not `/converter`.** `/converter` answers a wrong secret in a way that made
  the old test report success.
- **A binary input has no URL Only output**, because `/converter/from-file` always returns the file.
- **Conversion polling** re-sends the request with the same `key` every 2 s, 60 times. The `key` is new for each
  item so that the server never returns a cached result.
- **Extract operations save a `.txt` with one JSON paragraph** and the node parses it. The web Document Builder
  can return only files, and this is how it returns data.
- **The script injection boundary:** a Document Builder script runs on the server with full Api access. User data
  enters a template only through `buildScript` with `escapeJs` (inside string literals) or `toJsonLiteral`
  (`JSON.parse` of JSON). Plain text that is not JSON is double `JSON.stringify`-ed. Do not add any other path.
- **The vendored formats file** is the only source of format lists. Never hard-code format lists.
- **Automation test pitfalls:** vitest sets `NODE_ENV=test`, and the n8n CLI then silently does nothing, so setup
  forces `production`. `n8n execute` output is cut off in a pipe, so it goes to a file.
- **CI pins the Document Server tag** (`documentserver-de:10.0`) because runners keep a cached `latest` and do not
  pull it again.
- **CI runs on Gitea Actions** (`git.onlyoffice.com`), and the repository is mirrored to GitHub. `paths-ignore`
  skips Markdown-only and `.github/**`-only pushes, so use `workflow_dispatch` to run a changed workflow.

## 6. Known issues and tech debt

- **There are no unfinished branches.** The remote has `develop`, `master` and `release/1`. `release/1` was the
  0.0.1 release branch and is already merged into `develop`.
- **`master` has no code** (see section 4). The first release PR from `develop` to `master` brings the whole package
  in, so review it as such.
- **`pnpm lint` fails on `develop`** (the Audit runs on `develop` have failed since 2026-10-13). The rule `@n8n/community-nodes/no-template-placeholders` rejects the
  `maintainers` entry in `package.json` (`Ascensio System SIA <integration@onlyoffice.com> (…)`). The Audit workflow is
  red until this is fixed, so fix it before the next release (for example, drop `maintainers`; `author` already
  holds the same data).
- **`CHANGELOG.md` `[Unreleased]` is incomplete.** Several user-visible fixes since 0.0.2 are not listed. 0.0.2 was
  built from commit `b964903` (there is no tag), so compare with `git log --no-merges b964903..origin/develop -- nodes`
  before the release.
- **The unreleased Docs 10 changes on `develop`** need a version decision. They raise the minimum to Docs 10.0, which
  is a breaking change for users on 9.x, so 0.1.0 at least.
- `onlyoffice-n8n-docs-development` says "Lint is currently clean". That is no longer true; update it together with
  the lint fix.
- Conversion errors show only the Document Server error code (for example `-4`), with no explanation for the user.
- `OnlyofficeDocs.node.ts` has 1400 lines: the description and the Conversion `execute` are in one file.

## 7. Plans and commitments

There are no open plans and no commitments to customers or partners.

## Smoke checks

The automation suite (`bash test/docker.sh`, also run by CI on every push to `develop`/`master`) runs **every
operation** of both resources against a real Document Server 10 and checks the result files, so no extra smoke
tests are needed. Before a release, also check by hand what the suite cannot see:

- [ ] Install the packed `.tgz` (or the published version) through **Settings → Community Nodes** in a clean n8n. The
      node and its credential appear.
- [ ] Credential test: the right secret shows the Document Server version, and a wrong secret shows an error.
- [ ] Convert with a URL input and the File Data output; open the result file.
- [ ] Convert with a binary input (from Read/Write Files or HTTP Request).
- [ ] Mail Merge with two records: two output items, each with its own file.
- [ ] One error case with and without **Continue On Fail**.
- [ ] Use the node as a tool of an AI Agent and let it call one conversion.
- [ ] Optional: run the automation tests once against a Document Server with `token.purposeCheck: strict`.
