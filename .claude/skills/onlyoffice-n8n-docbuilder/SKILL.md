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
classes); web service needs Docs 10.0+.

## Script building (the injection boundary)

- Templates contain `%%NAME%%` markers; `buildScript(template, { NAME: value })` replaces them by `split/join`.
- Strings in `"..."` literals → `escapeJs(value)` (escapes `\`, `"`, `\n`, `\r`, `\t`). Used for `FILE_URL`,
  `OUTPUT_FORMAT`, titles, `CHUNK_BY`, search column/value.
- Structured data → `JSON.parse(%%X_JSON%%)` with `toJsonLiteral(value)` (= `JSON.stringify` of the JSON string; accepts
  both an n8n JSON string and an object). Never insert user data into a template any other way — the script runs on
  the DS with full Api access.
- Templates are ES5-style (`var`, no modules), globals `builder`, `Api`. Every script ends with
  `builder.SaveFile(<ext>, "output.<ext>")` + `builder.CloseFile()`.
- Input documents are opened by URL (`builder.OpenFile("<url>")`), so `builderFileUrl` must be reachable from the DS.

## Operations

**Extract** (`builderFileUrl` only, plus `builderChunkBy`). The script empties the document, writes one paragraph
with `JSON.stringify(result)` and saves **txt**; the node parses it: array → one item per element, object → one
item, non-JSON → `{ text }`. No output file parameters.

| Operation         | Output items                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `extractText`     | one per body element: `{ type: 'paragraph', text, index }` or `{ type: 'table', rows: string[][], index }` |
| `extractOutline`  | one per heading (paragraph style `Heading N`): `{ level, text, index }`                                |
| `extractTables`   | one per table: `{ tableIndex, headers[], rows[][], records[] }` — `records` = `{header: value}` objects (row 1 = headers) |
| `extractChunks`   | one per chunk: `{ text, metadata: { section, headingLevel, … } }`; `headings` (default) adds `elementStart/elementEnd`, `paragraphs` adds `isHeading/elementIndex`; tables become `a \| b` lines |
| `extractMetadata` | one item `{ paragraphs, headings, tables, estimatedWords, characters }`                                |

**Generate / Modify** — one item `{ fileName, operation, outputUrl }` + binary (`builderBinaryPropertyName`, default
`data`) unless `builderOutputMode: 'urlOnly'`. `builderOutputFormat` (docx/pdf/pptx) only where noted.

| Operation              | Inputs                                                                                                  | Format        |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ------------- |
| `createDocument`       | `builderText` (each line = paragraph), `builderTitle` (optional bold 14 pt first paragraph)             | param         |
| `markdownToDoc`        | `builderMarkdown`: H1–H6, bold, italic, inline code, bullet/numbered lists, fenced code                  | param         |
| `jsonToTable`          | `builderTableData` array of objects (keys of the **first** object = columns), `builderTableTitle`       | param         |
| `generateSpreadsheet`  | `builderTableData` (keys of the first object → bold row 1), `builderTableTitle` = **sheet name**         | xlsx          |
| `generatePresentation` | `builderSlidesData` array: `title`, `body`, `background` / `titleColor` / `bodyColor` (`#hex`), `titleSize` / `bodySize` in half-points (defaults 40 = 20 pt, 24 = 12 pt), `titleBold` (default true), `bodyBold`, `titleAlign` / `bodyAlign` (`left`/`center`/`right`) | pptx |
| `fillTemplate`         | `builderFileUrl` template with `{{key}}`, `builderTemplateData` object (`{{ $json }}` = whole item)     | param         |
| `mailMerge`            | `builderFileUrl`, `builderRecords` array → **one item per record** `{ success, fileName: <name>_<n>.<ext>, recordIndex, record, outputUrl }` | param |
| `appendContent`        | `builderFileUrl`, `builderParagraphs`: strings or `{ text, bold }`, appended at the end                  | param         |
| `appendRows`           | `builderFileUrl` xlsx, `builderTableData`; keys must equal row-1 headers exactly, rows go after the first empty cell in column A | xlsx |
| `updateRow`            | `builderFileUrl` xlsx, `builderSearchColumn` (exact, case-sensitive header), `builderSearchValue` (string compare), `builderUpdates` `{ column: value }`; updates **all** matching rows | xlsx |

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
4. Ask the user to run it against a real DS (a broken script returns an error code, not a message). README
   Operation Details + CHANGELOG.
