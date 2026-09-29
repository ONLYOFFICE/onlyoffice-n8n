---
name: onlyoffice-n8n-docs
description:
  The ONLYOFFICE Docs n8n node package (@onlyoffice/n8n-nodes-docs) - repo map, credential and JWT,
  the Conversion resource (URL vs binary input, output modes, polling, error codes, formats) and task
  workflows. Use at the start of every task in this repo; load onlyoffice-n8n-docbuilder for the Document Builder
  resource and onlyoffice-n8n-docs-development for node API, lint, verification and review.
---

# ONLYOFFICE Docs n8n node

One node `ONLYOFFICE Docs` (`onlyofficeDocs`) with resources **Conversion** (`/converter`) and **Document Builder**
(`/docbuilder`), one credential `onlyofficeDocsApi`. Requires **ONLYOFFICE Docs 10.0+** (from-file conversion and the
web DocBuilder service).

## Repo map

| Path                                              | What                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `nodes/OnlyofficeDocs/OnlyofficeDocs.node.ts`     | Description (all parameters of both resources), credential test, loadOptions, `execute` (Conversion inline; Document Builder delegated) |
| `nodes/OnlyofficeDocs/GenericFunctions.ts`        | `signJwt`, `escapeJs`, `buildScript`, `pollConversion`, `executeDocBuilder`, `executeMailMerge` |
| `nodes/OnlyofficeDocs/scripts.ts`                 | DocBuilder script templates (`onlyoffice-n8n-docbuilder`)                                 |
| `nodes/OnlyofficeDocs/formats.ts`                 | Format option lists from `document-formats/onlyoffice-docs-formats.json`                  |
| `nodes/OnlyofficeDocs/document-formats/`          | Vendored copy of ONLYOFFICE/document-formats (not a submodule) — replace whole, never hand-edit |
| `credentials/OnlyofficeDocsApi.credentials.ts`    | `docsServerUrl`, `jwtSecret` (required, password), `jwtHeader` (default `Authorization`)  |

## Credential and JWT

- `docsServerUrl` trailing `/` stripped, paths `/converter`, `/converter/from-file`, `/docbuilder` appended.
- `signJwt(payload, secret)`: hand-written HS256 (`crypto.createHmac`), no `iat`/`exp`. JSON requests: sign the body
  **before** adding `token`, send it in `body.token` and in `<jwtHeader>: Bearer <token>`. New body fields go before
  signing. DocBuilder signs `{}` (header only). Multipart from-file: token as form field `token` (params inside the
  token), or a `params` field when there is no secret.
- `credentialTest` posts a docx→pdf conversion of `https://example.com/test.docx` with `this.helpers.request` (the
  only helper of `ICredentialTestFunctions`).

## Conversion resource

Common parameters: `fileSource` (`url` | `binary`), `fileUrl` / `inputBinaryField`, `inputFormat`, `outputMode`
(`binary` = File Data | `urlOnly`), `outputFileName`, `binaryPropertyName`.

| Operation (`value`)       | `outputtype`        | Extra body fields                                                            |
| ------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| `convert`                 | Output Format param | —                                                                            |
| `convertToPdf`            | `pdf`               | —                                                                            |
| `thumbnail`               | `png` / `jpg`       | `thumbnail: {width, height, aspect (0 stretch, 1 crop, 2 fit), first}`; `first: false` → zip |
| `removePassword`          | Output Format param | `password`                                                                   |
| `spreadsheetToPdf`        | `pdf`               | `spreadsheetLayout: {orientation, scale?, fitToWidth?, fitToHeight?, gridLines?, headings?, ignorePrintArea?, margins?, pageSize?}` |
| `watermark`               | `pdf`               | `watermark: {transparent, type, width, height, rotate?, paragraphs:[{align, runs:[{text, fill:[r,g,b], font…}]}]}` |

Request paths (`execute`):

- **URL source**: JSON `POST /converter`, `async: false`, `url`, random `key` (`n8n_<ms>_<rand>`, never cached),
  `title`. The DS must be able to download `fileUrl`.
- **Binary source**: multipart `POST /converter/from-file` (hand-built boundary, file part + `token`/`params`).
  File Data → `async: false`, the response **is the converted file** (arraybuffer). URL Only → `async: true`, JSON
  with `fileUrl`.
- No `fileUrl` and no `endConvert` → `pollConversion`: re-POST `/converter` with the returned `key` every 2 s, 60
  attempts, then "Conversion timed out after 2 minutes".
- File Data downloads `fileUrl` (DS public host — n8n must reach it). Output JSON: `success, fileName, inputFormat,
  outputFormat, operation, convertedUrl` (URL Only: without `fileName`).

Formats: `formats.ts` keeps entries with a non-empty `convert` list; `getInputFormats` switches on `operation` (pdf
targets, `type === 'cell'` for spreadsheets, png/jpg for thumbnails), `getOutputFormats` depends on `inputFormat` and
falls back to all targets for expressions.

Conversion error codes: `-1` unknown, `-2` timeout, `-3` conversion error (bad file / wrong `filetype`), `-4` source
download failed (URL not reachable **from the DS** — localhost, Docker network), `-5` wrong password, `-6` result
database error, `-7` input error, `-8` invalid token (secret or header mismatch). The node shows only the number.

## Rules

- Keep one node with `resource`/`operation`; Document Builder logic stays in `GenericFunctions.ts` / `scripts.ts`.
- All DS calls signed; `jwtSecret` is required, a DS without JWT is not supported by the credential.
- Formats only from the vendored JSON; no hard-coded lists.
- CHANGELOG `[Unreleased]` + README (Operations, Operation Details, Credentials, Prerequisites) for user-visible
  changes.

## Workflows

- **Bug fix**: trace parameter → `execute` branch (URL / binary × File Data / URL Only) → request → response → output.
  Fix all four combinations if the code is shared. Lint, build, manual run (`onlyoffice-n8n-docs-development`), `### Fixed` entry.
- **New conversion operation**: operation option (alphabetical, with `action`), parameters scoped by `displayOptions`,
  `getInputFormats` case, `execute` case filling `conversionParams` + `outputFormat`; README + CHANGELOG.
