---
name: onlyoffice-n8n-docbuilder
description:
  The Document Builder resource of the ONLYOFFICE Docs n8n node - how scripts in scripts.ts are built and sent
  to /docbuilder, placeholder and escaping rules, the txt-JSON trick of extract operations, output shapes, mail merge,
  and how to add an operation. Use for any change to Document Builder operations or scripts.
---

# Document Builder resource

`resource: 'docbuilder'`. Each operation = one JS template in `scripts.ts`, filled in `executeDocBuilder`
(`GenericFunctions.ts`) and POSTed as raw body to `<docsServerUrl>/docbuilder` (`Content-Type:
application/octet-stream`, header `<jwtHeader>: Bearer signJwt({})`). Response `{ urls: { "output.<ext>": url } }` or
`{ error }`; the node takes the first URL. API: https://api.onlyoffice.com/docs/document-builder/ (builder / Api
classes); the web service works on Docs 9.4.1 as well.

## Script building (the injection boundary)

- Templates contain `%%NAME%%` markers (upper case and `_` only); `buildScript(template, { NAME: value })` replaces
  them in one regex pass, so markers inside inserted values stay as they are.
- Strings in `"..."` literals → `escapeJs(value)` (escapes `\`, `"`, `\n`, `\r`, `\t`). Used for `FILE_URL`,
  `OUTPUT_FORMAT`, titles, `CHUNK_BY`, search column/value.
- Structured data (`type: 'json'` parameters) → `JSON.parse(%%X_JSON%%)` with `toJsonLiteral(value)`: it takes an n8n
  JSON string as is and stringifies objects. A JSON field typed by the user arrives as a **string**; code that uses
  the value itself (Mail Merge records) parses it with `jsonParse` first.
- Plain text that is not JSON (Markdown, Create Document lines) → `JSON.stringify(JSON.stringify(value))`, never
  `toJsonLiteral`, which would `JSON.parse` the raw text in the script and fail.
- Never insert user data into a template any other way — the script runs on the DS with full Api access.
- Templates are ES5-style (`var`, no modules), globals `builder`, `Api`. Every script ends with
  `builder.SaveFile(<ext>, "output.<ext>")` + `builder.CloseFile()`.
- Input documents are opened by URL (`builder.OpenFile("<url>")`), so `builderFileUrl` must be reachable from the DS.

## Operations

**Extract** (`builderFileUrl` only, plus `builderChunkBy`). The script empties the document, writes one paragraph
with `JSON.stringify(result)` and saves **txt**; the node parses it: array → one item per element, object → one
item, non-JSON → `{ text }`. No output file parameters.

| Operation         | Output items                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `extractText`     | one per body element: `{ type: 'paragraph', text, index }` or `{ type: 'table', rows: string[][], index }`                                                                                       |
| `extractOutline`  | one per heading (paragraph style `Heading N`): `{ level, text, index }`                                                                                                                          |
| `extractTables`   | one per table: `{ tableIndex, headers[], rows[][], records[] }` — `records` = `{header: value}` objects (row 1 = headers)                                                                        |
| `extractChunks`   | one per chunk: `{ text, metadata: { section, headingLevel, … } }`; `headings` (default) adds `elementStart/elementEnd`, `paragraphs` adds `isHeading/elementIndex`; tables become `a \| b` lines |
| `extractMetadata` | one item `{ paragraphs, headings, tables, estimatedWords, characters }`                                                                                                                          |

**Generate / Modify** — one item `{ fileName, operation, outputUrl }` + binary (`builderBinaryPropertyName`, default
`data`) unless `builderOutputMode: 'urlOnly'`. In URL Only mode the output file name and binary field are hidden and
n8n keeps no value for them, so they are read with the defaults `'output'` / `'data'` as fallbacks.
`builderOutputFormat` (docx/pdf/pptx) only where noted.

| Operation              | Inputs                                                                                                                                                                                                                                                                  | Format |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `createDocument`       | `builderText` (each line = paragraph), `builderTitle` (optional bold 14 pt first paragraph)                                                                                                                                                                             | param  |
| `markdownToDoc`        | `builderMarkdown`: H1–H6, bold, italic, inline code, bullet/numbered lists, fenced code                                                                                                                                                                                 | param  |
| `jsonToTable`          | `builderTableData` array of objects (keys of the **first** object = columns), `builderTableTitle`                                                                                                                                                                       | param  |
| `generateSpreadsheet`  | `builderTableData` (keys of the first object → bold row 1), `builderTableTitle` = **sheet name**                                                                                                                                                                        | xlsx   |
| `generatePresentation` | `builderSlidesData` array: `title`, `body`, `background` / `titleColor` / `bodyColor` (`#hex`), `titleSize` / `bodySize` in half-points (defaults 40 = 20 pt, 24 = 12 pt), `titleBold` (default true), `bodyBold`, `titleAlign` / `bodyAlign` (`left`/`center`/`right`) | pptx   |
| `fillTemplate`         | `builderFileUrl` template with `{{key}}`, `builderTemplateData` object (`{{ $json }}` = whole item)                                                                                                                                                                     | param  |
| `mailMerge`            | `builderFileUrl`, `builderRecords` (array or JSON text) → **one item per record** `{ success, fileName: <name>_<n>.<ext>, recordIndex, record, outputUrl }`                                                                                                             | param  |
| `appendContent`        | `builderFileUrl`, `builderParagraphs`: strings or `{ text, bold }`, appended at the end                                                                                                                                                                                 | param  |
| `appendRows`           | `builderFileUrl` xlsx, `builderTableData`; keys must equal row-1 headers exactly, rows go after the first empty cell in column A                                                                                                                                        | xlsx   |
| `updateRow`            | `builderFileUrl` xlsx, `builderSearchColumn` (exact, case-sensitive header), `builderSearchValue` (string compare), `builderUpdates` `{ column: value }`; updates **all** matching rows                                                                                 | xlsx   |

Chaining (the intended workflows): `{{ $json.outputUrl }}` of a previous step as the next `builderFileUrl`;
`{{ $json.records }}` of Extract Tables as `builderTableData` for JSON to Table / Generate Spreadsheet / Append Rows.
All results for one input item get that item's `pairedItem`.

## Adding an operation

1. Write the template in `scripts.ts` (export a const, `%%PLACEHOLDER%%` for every input, JSON via `JSON.parse`).
   Extract-type → save txt with the JSON paragraph trick and add the value to `EXTRACT_ONLY_OPERATIONS` (and
   `EXTRACT_SCRIPTS` if it only needs `FILE_URL`).
2. Add a `case` in `executeDocBuilder`: read parameters with `itemIndex`, `buildScript` with `escapeJs` /
   `toJsonLiteral`, set `outputExtension`.
3. Description: operation option (alphabetical, `action` + `description`), parameters with `displayOptions.show:
{ resource: ['docbuilder'], operation: [...] }`; add the operation to the `show`/`hide` lists of `builderFileUrl`,
   `builderOutputMode`, `builderOutputFormat`, `builderOutputFileName`, `builderBinaryPropertyName` as needed — these
   lists are easy to forget.
4. Tests: in `test/unit/docbuilder.test.ts` check the script with `callsOf` (texts written, runs to
   `builder.CloseFile` with hostile input); add a workflow to `test/automation/workflows/` and a test that checks the
   result, ideally through an Extract step. A broken script only returns an error code, so run the automation tests
   (`bash test/docker.sh`, after the user confirms). README Operation Details + CHANGELOG.
